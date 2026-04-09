import json
import os
import asyncio
import json_repair
from typing import Dict, Any

ANTI_HALLUCINATION_DIRECTIVE = """
⚠️ REGOLE PER L'ANALISI:

1. INTEGRITÀ DEI FATTI — Dati specifici sul brand (numeri, clienti, fatturati, anni di esperienza,
   competenze dichiarate) devono provenire dai dati forniti. NON inventare statistiche, numeri o
   credenziali che non trovi nelle fonti. Se non sai quanti anni di esperienza ha → non menzionarli.

2. USA LE PAROLE DEL BRAND — NON tradurre la terminologia del brand in gergo tecnico diverso.
   Se il sito dice "aiuto e-commerce a ottenere clienti", NON scrivere "specializzato in lead generation".
   Se il sito parla di "e-commerce e attività locali", NON scrivere "lead generation" o "B2B enterprise".
   Il posizionamento e il vocabolario devono riflettere come il brand si presenta REALMENTE.
   NON rietichettare i servizi: se un servizio include gestione completa (campagne, creatività,
   ottimizzazione, reportistica), è un servizio di GESTIONE DONE-FOR-YOU, NON una consulenza.
   "Consulenza" = il professionista dà consigli e il cliente esegue. Se il professionista esegue → gestione.
   Usa i NOMI ORIGINALI dei servizi così come li chiama il brand.
   ATTENZIONE AI CTA: bottoni come "Richiedi una Consulenza Gratuita" o "Prenota una Call" sono il
   processo di vendita (call conoscitiva), NON la descrizione del servizio. Per capire cosa FA il servizio,
   leggi il corpo della pagina: "Come Funziona", "Cosa Include", le fasi operative.

3. ANALIZZA TUTTO — Usa TUTTI i dati disponibili, anche se sono pochi. Poche recensioni sono
   comunque recensioni reali da analizzare. Pochi servizi meritano comunque un'analisi approfondita.
   Non dire "dati insufficienti" se i dati ci sono — analizzali a fondo.
   Se i dati sono davvero assenti, fai inferenze di settore dichiarandole come tali.

4. PROFONDITÀ — Per ogni elemento trovato nei dati, vai in profondità. Non limitarti a elencare:
   analizza, suggerisci strategie, crea angoli di marketing. Più è dettagliata l'analisi, meglio è.
   La brevità è accettabile SOLO se davvero non ci sono dati. Se ci sono dati → approfondisci.
"""

async def run_workflow_task(service, task: Dict[str, Any], context: Dict[str, Any]) -> Any:
    """Executes a single step of the dynamic workflow."""
    step_id = task["step_id"]
    model_choice = task.get("recommended_model", "claude")
    system_prompt_template = task["system_prompt"]

    # 1. Gather Required Inputs — con limiti per contenere i costi
    # Dati grezzi (scraping) sono enormi e ripetitivi; output AI precedenti sono compatti
    # site_content è già pre-processato (estrazione strutturata), non serve troncarlo
    RAW_DATA_KEYS = {"social_data", "ads_data", "raw_docs",
                     "google_reviews", "instagram_comments", "competitor_data",
                     "products_csv", "services_txt"}
    MAX_RAW_CHARS = 25000   # Dati grezzi: max 25K chars
    MAX_AI_CHARS = 12000    # Output AI precedenti: max 12K chars

    input_text = ""
    for req in task.get("required_inputs", []):
        if req in context and context[req]:
            val = context[req]
            if isinstance(val, dict) or isinstance(val, list):
                val_str = json.dumps(val, indent=2, ensure_ascii=False)
            else:
                val_str = str(val)
            # Tronca per contenere token — limiti generosi per non perdere qualità
            max_chars = MAX_RAW_CHARS if req in RAW_DATA_KEYS else MAX_AI_CHARS
            if len(val_str) > max_chars:
                val_str = val_str[:max_chars]
            input_text += f"\n--- {req.upper()} ---\n{val_str}\n"

    # Anti-hallucination as SYSTEM message (stronger enforcement than user message)
    final_prompt = f"{system_prompt_template}\n\n{input_text}"
    messages = [
        {"role": "system", "content": ANTI_HALLUCINATION_DIRECTIVE},
        {"role": "user", "content": final_prompt}
    ]
    
    # 2. Select AI Model Map
    model_map = {
        "claude": "anthropic/claude-3.7-sonnet",
        "gemini": "google/gemini-1.5-pro",
        "perplexity": "perplexity/sonar"
    }
    target_model = model_map.get(model_choice, model_map["claude"])
    
    print(f"[Workflow Engine] Executing Task: {step_id} using {target_model}")
    
    # 3. Execute with Retries
    max_retries = 3
    attempt = 0
    response_json = {}
    
    while attempt < max_retries:
        attempt += 1
        try:
            print(f"[Workflow Engine] Executing Task: {step_id} using {target_model} (Attempt {attempt}/{max_retries})")
            
            response_str = await service._call_ai(
                model=target_model,
                messages=messages,
                max_tokens=8000
            )
            
            response_json = json_repair.loads(response_str)
            
            # Check for error objects returned instead of valid data
            if isinstance(response_json, dict) and "error" in response_json:
                raise Exception(f"AI returned error object: {response_json['error']}")
            if isinstance(response_json, list) and len(response_json) > 0 and isinstance(response_json[0], dict) and "error" in response_json[0]:
                raise Exception(f"AI returned error array: {response_json[0]['error']}")
                
            # Content validation: if reviews_voc is completely empty, force retry
            if step_id == "reviews_voc" and isinstance(response_json, dict):
                gh = response_json.get("golden_hooks", response_json.get("hooks", []))
                kv = response_json.get("key_vocabulary", response_json.get("vocabulary", []))
                if not gh and not kv:
                    raise Exception("Voice of Customer returned empty data arrays. Retrying.")

            # Content validation: service_vertical must have non-empty services array
            if step_id == "service_vertical" and isinstance(response_json, dict):
                services = response_json.get("services", [])
                if not services:
                    raise Exception("Analisi Verticale Servizi returned empty services array. Retrying with stronger context.")
                # Also check that services have actual content, not just names
                for svc in services:
                    if isinstance(svc, dict):
                        tech = svc.get("technical_analysis", {})
                        if isinstance(tech, dict) and not tech.get("description"):
                            raise Exception(f"Service '{svc.get('name', '?')}' has empty technical_analysis. Retrying.")

            # Content validation: product_portfolio must have non-empty items array
            if step_id == "product_portfolio" and isinstance(response_json, dict):
                items = response_json.get("items", [])
                if not items:
                    raise Exception("Portafoglio Prodotti returned empty items array. Retrying.")
                # Check items have substantive descriptions (not just a name)
                for item in items:
                    if isinstance(item, dict):
                        desc = item.get("description", "")
                        if len(str(desc)) < 50:
                            raise Exception(f"Item '{item.get('name', '?')}' has insufficient description ({len(str(desc))} chars). Retrying for deeper analysis.")
                    
            # If we get here, success!
            return response_json
            
        except Exception as e:
            print(f"[Workflow Engine] Error in {step_id} (Attempt {attempt}): {e}")
            if attempt < max_retries:
                print(f"[Workflow Engine] Switching model and retrying {step_id}...")
                # Switch model for retry
                if target_model == "anthropic/claude-3.7-sonnet":
                    target_model = "google/gemini-1.5-pro"
                elif target_model == "google/gemini-1.5-pro":
                    target_model = "anthropic/claude-3.7-sonnet"
            else:
                print(f"[Workflow Engine] Failed {step_id} after {max_retries} attempts.")
                response_json = {"error": str(e)}
        
    return response_json


async def generate_complete_strategic_analysis(
    service,
    client_info: Dict[str, Any],
    site_url: str,
    site_content: str = "",
    social_data: str = "",
    ads_data: str = "",
    raw_docs: str = "",
    google_reviews: str = "",
    instagram_comments: str = "",
    products_csv: str = "",
    services_txt: str = "",
    competitor_data: str = "",
    progress_callback=None
) -> Dict[str, Any]:

    def _report(msg: str):
        if progress_callback:
            progress_callback(msg)
        print(f"[Workflow Engine] {msg}")

    # 1. Load the Master Workflow JSON
    workflow_path = os.path.join(os.path.dirname(__file__), "master_workflows", "agostinis_meta_ads.json")
    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow = json.loads(f.read())

    _report(f"Workflow caricato: {workflow.get('workflow_name')}")

    # 2. PRE-PROCESSING: Leggi TUTTI i dati grezzi UNA VOLTA e crea estrazioni strutturate
    # Invece di mandare dati grezzi (site 80K, reviews 25K, docs 25K, comments 25K)
    # a 5-9 step ciascuno, li leggiamo una volta e estraiamo il succo.

    # ── 2a. Pre-processing SITO WEB (usato in 5 step) ──
    site_extraction = site_content or ""
    if site_content and len(site_content) > 500:
        _report("Pre-analisi sito web…")
        try:
            site_extraction = await service._call_ai(
                model="anthropic/claude-3.7-sonnet",
                messages=[{"role": "user", "content": f"""Estrai TUTTO dal contenuto di questo sito web in modo COMPLETO e STRUTTURATO:

1. CHI È: Nome brand, settore, posizionamento, storia, mission, valori
2. COSA OFFRE: TUTTI prodotti/servizi con descrizioni, prezzi, caratteristiche
3. COME LO OFFRE: Processo, metodologia, fasi, cosa include ogni servizio
4. A CHI SI RIVOLGE: Target dichiarato, problemi che risolve
5. PROVE: Testimonial, numeri, risultati, casi studio, certificazioni
6. TONO E VOCE: Come comunica, parole usate, stile
7. CTA E OFFERTE: Prossimi passi, prezzi, garanzie
8. DIFFERENZIATORI: Cosa lo distingue dalla concorrenza

REGOLE: Usa le PAROLE ESATTE del sito. Nomi servizi/prodotti esattamente come scritti. Non riassumere troppo.
Distingui servizio (professionista fa) vs consulenza (dà consigli).

CONTENUTO SITO:
{site_content[:80000]}"""}],
                max_tokens=6000
            )
            _report(f"Pre-analisi sito completata ({len(site_extraction)} chars)")
        except Exception as e:
            print(f"⚠️ Pre-analisi sito fallita: {e}")
            site_extraction = site_content[:25000] if site_content else ""

    # ── 2b. Pre-processing RECENSIONI + COMMENTI (reviews 5 step, comments 4 step) ──
    reviews_extraction = google_reviews or ""
    comments_extraction = instagram_comments or ""
    has_reviews = google_reviews and len(google_reviews) > 200
    has_comments = instagram_comments and len(instagram_comments) > 200
    if has_reviews or has_comments:
        _report("Pre-analisi recensioni e commenti…")
        reviews_block = f"RECENSIONI GOOGLE:\n{google_reviews[:40000]}" if has_reviews else ""
        comments_block = f"COMMENTI INSTAGRAM:\n{instagram_comments[:40000]}" if has_comments else ""
        try:
            voc_extraction = await service._call_ai(
                model="anthropic/claude-3.7-sonnet",
                messages=[{"role": "user", "content": f"""Analizza TUTTE le recensioni e i commenti e estrai in modo COMPLETO:

1. GOLDEN HOOKS: Frasi esatte dei clienti che esprimono trasformazione/risultato (copia letteralmente)
2. PAIN POINTS: Problemi, frustrazioni, dolori PRIMA del prodotto/servizio
3. DESIDERI E RISULTATI: Cosa vogliono ottenere, cosa hanno ottenuto
4. OBIEZIONI: Dubbi, esitazioni, scetticismo iniziale
5. LINGUAGGIO REALE: Parole e espressioni usate dai clienti (non parafrasare)
6. PATTERN: Temi ricorrenti, elementi più citati, sentiment generale
7. SOCIAL PROOF: Storie specifiche, risultati quantificabili, nomi citati

REGOLE: Cita letteralmente le frasi più potenti. Distingui recensioni del brand da quelle dei competitor (se marcate).

{reviews_block}

{comments_block}"""}],
                max_tokens=5000
            )
            if has_reviews:
                reviews_extraction = voc_extraction
            if has_comments:
                comments_extraction = voc_extraction
            _report(f"Pre-analisi VoC completata ({len(voc_extraction)} chars)")
        except Exception as e:
            print(f"⚠️ Pre-analisi VoC fallita: {e}")

    # ── 2c. Pre-processing DOCUMENTI CARICATI (usato in 9 step!) ──
    docs_extraction = raw_docs or ""
    if raw_docs and len(raw_docs) > 500:
        _report("Pre-analisi documenti caricati…")
        try:
            docs_extraction = await service._call_ai(
                model="anthropic/claude-3.7-sonnet",
                messages=[{"role": "user", "content": f"""Estrai TUTTE le informazioni utili da questi documenti caricati dal cliente:

1. INFO SUL BRAND: identità, storia, valori, posizionamento
2. PRODOTTI/SERVIZI: descrizioni, prezzi, caratteristiche, processi
3. TARGET: chi sono i clienti, come vengono descritti
4. DATI E NUMERI: statistiche, risultati, metriche
5. COMPETITOR: menzioni di concorrenti, differenziatori
6. ALTRO: qualsiasi info rilevante per analisi marketing

REGOLE: Estrai tutto, usa le parole esatte dei documenti.

DOCUMENTI:
{raw_docs[:50000]}"""}],
                max_tokens=5000
            )
            _report(f"Pre-analisi documenti completata ({len(docs_extraction)} chars)")
        except Exception as e:
            print(f"⚠️ Pre-analisi documenti fallita: {e}")

    # 3. Initialize the Global Context con dati PRE-PROCESSATI
    context = {
        "client_info": client_info,
        "site_url": site_url,
        "site_content": site_extraction,
        "social_data": social_data,
        "ads_data": ads_data,
        "raw_docs": docs_extraction,
        "google_reviews": reviews_extraction,
        "instagram_comments": comments_extraction,
        "products_csv": products_csv,
        "services_txt": services_txt,
        "competitor_data": competitor_data
    }

    # 3. Sequential Execution loop (guarantees context inheritance)
    results = {}
    total_tasks = len(workflow["tasks"])

    for i, task in enumerate(workflow["tasks"], 1):
        step_id = task["step_id"]
        task_name = task.get("title", step_id)

        # Skip vertical analysis if product_portfolio has no items of that type
        portfolio = context.get("product_portfolio")
        if isinstance(portfolio, dict) and portfolio.get("items"):
            portfolio_items = portfolio["items"]
            has_products = any(it.get("type") == "product" for it in portfolio_items if isinstance(it, dict))
            has_services = any(it.get("type") == "service" for it in portfolio_items if isinstance(it, dict))

            if step_id == "product_vertical" and not has_products:
                _report(f"[{i}/{total_tasks}] ⏭️ Skipping {task_name} — nessun prodotto nel portfolio")
                results[step_id] = None
                context[step_id] = None
                continue

            if step_id == "service_vertical" and not has_services:
                _report(f"[{i}/{total_tasks}] ⏭️ Skipping {task_name} — nessun servizio nel portfolio")
                results[step_id] = None
                context[step_id] = None
                continue

        _report(f"[{i}/{total_tasks}] {task_name}…")
        try:
            task_result = await run_workflow_task(service, task, context)
            results[step_id] = task_result
            context[step_id] = task_result

        except Exception as e:
            print(f"[Workflow Engine] Error executing task {step_id}: {e}")
            results[step_id] = {"error": str(e)}
            context[step_id] = {}

    _report(f"Tutte le {total_tasks} sezioni generate. Salvataggio…")

    # 4. Passthrough — I prompt chiedono già lo schema JSON esatto che i renderer React si aspettano.
    #    L'unica mappatura necessaria è step_id → frontend key dove differiscono.
    STEP_TO_FRONTEND_KEY = {
        "objections_management": "objections",
    }

    final_output = {}
    for step_id, data in results.items():
        frontend_key = STEP_TO_FRONTEND_KEY.get(step_id, step_id)
        final_output[frontend_key] = data

    return final_output
