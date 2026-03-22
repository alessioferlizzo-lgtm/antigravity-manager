import os
import httpx
import json
import json_repair
import re
from typing import List, Dict, Any
from dotenv import load_dotenv
from .notion_service import notion_service, NOTION_ANGLES_VAULT_DB_ID, NOTION_COPY_VAULT_DB_ID

# Caricamento prioritario del file .env in backend/
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
# Fallback se caricato dalla root
if not os.getenv("OPENROUTER_API_KEY"):
    load_dotenv(override=True)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY")

# DEBUG LOG al caricamento
if OPENROUTER_API_KEY:
    print(f"🤖 AIService: OpenRouter API Key caricata ({OPENROUTER_API_KEY[:6]}...)")
else:
    print("⚠️  AIService: OpenRouter API Key non trovata")

if GOOGLE_AI_API_KEY:
    print(f"🤖 AIService: Google AI API Key caricata ({GOOGLE_AI_API_KEY[:6]}...)")
else:
    print("⚠️  AIService: Google AI API Key non trovata")

class AIService:
    def __init__(self):
        self.headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://antigravity-app.com",
            "X-Title": "Antigravity App"
        }

    async def _call_ai(self, model: str, messages: List[Dict[str, Any]], temperature: float = 0.7, max_tokens: int = 16000) -> str:
        """Call AI with automatic fallback to Google Gemini if OpenRouter fails (402 Payment Required)"""

        # Try OpenRouter first
        if OPENROUTER_API_KEY:
            try:
                payload = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
                async with httpx.AsyncClient(timeout=600.0) as client:
                    response = await client.post(OPENROUTER_URL, headers=self.headers, json=payload)
                    response.raise_for_status()
                    result = response.json()

                    # LOGGING ESPLICITO PER L'UTENTE
                    model_used = result.get("model", model)
                    usage = result.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)

                    print(f"\n--- 🧠 CHIAMATA AI OPENROUTER ---")
                    print(f"Modello Richiesto: {model}")
                    print(f"Modello Risposto: {model_used}")
                    print(f"Token: {prompt_tokens} (prompt) + {completion_tokens} (completion) = {prompt_tokens + completion_tokens}")
                    print(f"-----------------------------\n")

                    choice = result["choices"][0]
                    finish_reason = choice.get("finish_reason", "")
                    content = choice["message"]["content"]
                    if finish_reason == "length":
                        print(f"WARNING: Response truncated (finish_reason=length). Length: {len(content)}")
                    return content
            except httpx.HTTPStatusError as e:
                if e.response.status_code in [401, 402, 403]:
                    print(f"⚠️  OpenRouter: {e.response.status_code} {e.response.reason_phrase} - Switching to Google Gemini fallback")
                else:
                    raise
            except Exception as e:
                print(f"⚠️  OpenRouter error: {e} - Switching to Google Gemini fallback")

        # Fallback to Google Gemini
        if GOOGLE_AI_API_KEY:
            print(f"\n--- 🧠 CHIAMATA AI GOOGLE GEMINI (FALLBACK) ---")
            return await self._call_google_gemini(messages, temperature, max_tokens)

        raise Exception("No AI provider available. Please configure OPENROUTER_API_KEY or GOOGLE_AI_API_KEY")

    async def _call_google_gemini(self, messages: List[Dict[str, Any]], temperature: float = 0.7, max_tokens: int = 16000) -> str:
        """Call Google Gemini API directly"""
        # Convert OpenAI-style messages to Gemini format
        gemini_contents = []
        system_instruction = None

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            if role == "system":
                system_instruction = content
            elif role == "user":
                gemini_contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                gemini_contents.append({"role": "model", "parts": [{"text": content}]})

        payload = {
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }

        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        # Use Gemini 1.5 Flash for speed and cost efficiency
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GOOGLE_AI_API_KEY}"

        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(gemini_url, json=payload)
            response.raise_for_status()
            result = response.json()

            print(f"Modello: Gemini 1.5 Flash")
            print(f"-----------------------------\n")

            content = result["candidates"][0]["content"]["parts"][0]["text"]
            return content

    async def perform_market_research(self, client_info: Dict[str, Any], raw_data: str, user_prompt: str = "", social_data: str = "") -> Dict[str, Any]:
        """Uses Perplexity (Sonar) to gather deep market data, enriched with real Meta/Instagram data."""
        client_name = client_info['name']
        links = client_info.get('links', [])
        competitors = client_info.get('competitors', [])

        # Format links
        formatted_links = []
        for l in links:
            if isinstance(l, dict):
                url = l.get('url', '')
                desc = l.get('description', '')
                formatted_links.append(f"{url} ({desc})" if desc else url)
            else:
                formatted_links.append(str(l))

        # Format competitors
        formatted_competitors = []
        for c in competitors:
            if isinstance(c, dict):
                comp_name = c.get('name', '')
                links_data = []
                for cl in c.get('links', []):
                    if isinstance(cl, dict):
                        l_url = cl.get('url', '')
                        l_label = cl.get('label', '')
                        links_data.append(f"{l_label}: {l_url}" if l_label else l_url)
                links_str = "; ".join(links_data)
                formatted_competitors.append(f"{comp_name} ({links_str})" if links_str else comp_name)
            else:
                formatted_competitors.append(str(c))

        competitors_context = f"\nCOMPETITOR DA ANALIZZARE:\n{chr(10).join(['- ' + c for c in formatted_competitors])}\n" if formatted_competitors else ""
        user_reqs = f"\n⚡ ISTRUZIONI SPECIALI (priorità massima):\n{user_prompt}\n" if user_prompt else ""
        file_context = f"\n📁 DOCUMENTI CARICATI (base di conoscenza interna):\n{raw_data}\n" if raw_data else ""

        # Social data block — flagged as PRIMARY source when present
        if social_data:
            social_block = f"""
🔴 DATI SOCIAL REALI — FONTE PRIMARIA ESTRATTA DIRETTAMENTE DALL'API META (NON INVENTATI)
Questi dati sono stati estratti in tempo reale dall'account Instagram del cliente tramite Meta Graph API.
Trattali come la tua fonte più autorevole. Analizzali parola per parola.

{social_data}

ISTRUZIONI OBBLIGATORIE SUI DATI SOCIAL:
- Estrai citazioni letterali dai commenti (le parole esatte che il pubblico usa).
- Identifica i pattern di engagement: quali tipi di post hanno più like/commenti e perché.
- Analizza il sentiment dominante (entusiasmo, dubbio, richieste frequenti, obiezioni).
- Nota le domande ricorrenti nei commenti: sono dolori non risolti = angoli di copy.
- Il linguaggio dei commenti È il linguaggio del copy. NON parafrasare, usa le stesse parole.
"""
        else:
            social_block = ""

        prompt = f"""Sei un Senior Market Researcher & Copywriter Strategist specializzato in Meta Ads e direct-response marketing.
Il tuo compito: produrre un'analisi strategica completa strutturata esattamente nelle fasi della metodologia professionale per Meta Ads.

━━━ CLIENTE ━━━
{client_name}

━━━ LINK E ASSET DA ANALIZZARE ━━━
{chr(10).join(['- ' + l for l in formatted_links]) if formatted_links else 'Nessun link fornito.'}
{competitors_context}
{social_block}
{file_context}
{user_reqs}

━━━ METODOLOGIA DI ANALISI ━━━

PRIORITÀ 1 — DATI REALI PRIMA DI TUTTO
- Parti SEMPRE dai dati social e dai documenti forniti (menu, catalogo, ecc.).
- Estrai citazioni letterali dai commenti. Sono oro per il copy.
- Per e-commerce: analizza i prodotti reali con prezzi e caratteristiche.
- Per attività locali: usa menu, listino, catalogo servizi se fornito.

PRIORITÀ 2 — RICERCA WEB
- Scansiona i link forniti. Cerca recensioni Google, citazioni, menzioni recenti.
- Identifica i prodotti/servizi REALI dell'attività, non fare supposizioni generiche.

━━━ REGOLE CRITICHE ━━━
- ZERO genericità: ogni affermazione deve essere concreta e specifica per questo cliente.
- Usa il linguaggio reale del target (es: "non riesco a dimagrire" non "difficoltà nel perdere peso").
- Segnala esplicitamente gli angoli ad alto engagement come prioritari.

RISPONDI ESCLUSIVAMENTE CON QUESTO JSON (nessun testo fuori dal JSON):
{{
  "industry": "Etichetta settore (max 5 parole)",
  "research_text": "ANALISI STRATEGICA COMPLETA — minimo 2500 parole. OBBLIGATORIAMENTE strutturata con questi esatti heading markdown:\\n\\n## FASE 1 — ANALISI DEL BUSINESS\\nCosa vende/offre (prodotti/servizi specifici con prezzi se disponibili). USP reale (cosa li distingue davvero). Canali di vendita. Posizionamento attuale.\\n\\n## FASE 2 — ANALISI DEL MERCATO\\nDimensione e caratteristiche del mercato. Trend rilevanti. Posizionamento rispetto ai competitor. Gap di mercato (cosa nessun competitor sta comunicando ma il target vuole sentire).\\n\\n## FASE 3 — TARGET DI RIFERIMENTO\\nProfilo demografico preciso (età, genere, localizzazione, reddito). Situazione attuale del target PRIMA di scoprire il cliente. Dolori principali (con citazioni reali se disponibili). Aspirazioni e trasformazione desiderata. Obiezioni più frequenti all'acquisto.\\n\\n## FASE 4 — DATI SOCIAL E VOCABOLARIO REALE\\nAnalisi dei contenuti ad alto engagement. Citazioni dirette dai commenti più significativi. Pattern di post che funzionano. Vocabolario che usa il target (frasi esatte, non parafrasate).\\n\\n## FASE 5 — ANGOLI CREATIVI PRIORITARI\\nTop 5 angoli comunicativi emersi dai dati reali. Per ognuno: nome angolo, perché funziona, frase hook di esempio. Priorità per fase del funnel (TOFU/MOFU/BOFU).",
  "key_products": ["prodotto/servizio 1 con dettaglio", "prodotto 2", "..."],
  "target_vocabulary": ["frase1 esatta dal target", "frase2", "frase3", "...almeno 15 voci"],
  "top_content_patterns": ["pattern1 ad alto engagement", "pattern2", "..."],
  "audience_pain_points": ["dolore1 con citazione reale", "dolore2", "dolore3"],
  "suggested_tone": "Etichetta sintetica del tono",
  "tone_description": "Descrizione dettagliata del tono con esempi concreti di frasi da usare e da evitare"
}}
"""

        messages = [{"role": "user", "content": prompt}]
        result_str = await self._call_ai("perplexity/sonar-pro", messages)
        return json_repair.loads(result_str)

    async def generate_communication_angles(self, research_content: str, user_prompt: str = "", funnel_stage: str = "") -> List[Dict[str, str]]:
        """Uses Claude to extract communication angles."""
        user_reqs = f"REQUISTI ADDIZIONALI DELL'UTENTE:\n{user_prompt}" if user_prompt else ""
        
        funnel_context = ""
        if funnel_stage:
            funnel_descriptions = {
                "discovery": "SCOPERTA (TOFU): Il pubblico NON conosce ancora il brand. Angoli che creano curiosità, rompono pattern, fanno scoprire qualcosa di nuovo. Focus su awareness.",
                "interest": "INTERESSE (MOFU): Il pubblico conosce il brand ma non è convinto. Angoli che costruiscono fiducia, mostrano competenza. Focus su engagement.",
                "decision": "DECISIONE (BOFU): Il pubblico sta valutando. Angoli che rimuovono obiezioni, mostrano risultati. Focus su conversione.",
                "action": "AZIONE: Il pubblico è pronto. Angoli con CTA dirette e urgenza intelligente. Focus su conversione immediata."
            }
            funnel_context = f"\nFASE DEL FUNNEL (adatta gli angoli a questa fase):\n{funnel_descriptions.get(funnel_stage, funnel_stage)}\n"
            
        # ── RAG DA NOTION ──
        # 1. Recupera i framework teorici attivi per questa fase del funnel
        frameworks_rules = await notion_service.get_copy_frameworks(funnel_stage)
        framework_context = f"\n=== REGOLE E FRAMEWORK OBBLIGATORI (Da rispettare tassativamente) ===\n{frameworks_rules}\n" if frameworks_rules else ""

        # 2. Recupera gli Swipe File vincenti (Headline/Angles) per il settore
        # Il settore andrebbe preso da client_info, per ora prendiamo tutto
        swipe_file_examples = await notion_service.get_vault_examples(NOTION_ANGLES_VAULT_DB_ID)
        swipe_context = f"\n=== ESEMPI GOLD STANDARD ('Swipe File') ===\nPrendi ispirazione e modella i tuoi angoli basandoti sulla qualità e sullo stile di questi esempi vincenti del passato, ma NON copiarli letteralmente:\n{swipe_file_examples}\n" if swipe_file_examples else ""
        
        prompt = f"""Basandoti su questa ricerca di mercato:
{research_content}

{user_reqs}
{funnel_context}
{framework_context}
{swipe_context}

Trova 5 angoli comunicativi unici e potenti per colpire il target in modo chirurgico.

REQUISITI:
1. NO BANALITÀ: Evita sconti, spedizioni gratis, clichés.
2. AUTORITÀ: Parla come l'esperto che svela una verità nascosta.
3. IMPATTO: Punta a trasformazioni identitarie o problemi profondi.

Per ogni angolo fornisci:
- "title": Titolo provocatorio e diretto
- "description": Concetto strategico
- "emotion": Emozione dominante (Adrenalina, Ossitocina, Dopamina, ecc.)

Rispondi ESCLUSIVAMENTE con un array JSON valido, senza testo prima o dopo."""
        
        messages = [{"role": "user", "content": prompt}]
        result = await self._call_ai("anthropic/claude-3.7-sonnet", messages)
        
        try:
            # Attempt to find and parse the JSON array
            start = result.find("[")
            end = result.rfind("]") + 1
            if start != -1 and end > start:
                json_str = result[start:end]
                return json_repair.loads(json_str)
            else:
                # If no array found, try to parse the whole string, or return empty
                return json_repair.loads(result) if result.strip().startswith('[') else []
        except Exception:
            # Fallback to an empty list if parsing fails
            return []

    async def generate_script(self, angle: Dict[str, str], research: str, rules: str, preferences: Dict[str, Any], script_instructions: str = "", variation_index: int = 0, total_variations: int = 1, original_script: str = "") -> str:
        """Generates a video script. Each variation has a distinct mandatory approach to ensure genuine diversity."""
        
        feedback_context = ""
        if preferences.get("feedback_history"):
            feedback_context = "Feedback precedenti da rispettare:\n" + "\n".join(preferences["feedback_history"])

        user_instructions = ""
        if script_instructions:
            user_instructions = f"""
=== MANDATO ASSOLUTO DELL'UTENTE (SORGENTE DI VERITÀ PRIORITARIA) ===
L'utente ha fornito queste istruzioni specifiche che DEVONO guidare lo script. 
Se queste istruzioni contengono un menù, un evento o un'idea specifica, usa QUESTE info come focus principale, ignorando o adattando l'angolo generico se in contrasto:
{script_instructions}

REGOLA GENERALE HIGHLIGHTS (LISTE/SERVIZI/PRODOTTI): Se l'input contiene elenchi lunghi (menù, lista servizi, catalogo prodotti), scegli sempre e solo i 3 elementi più impattanti e magnetici per mantenere lo script sotto i 30 secondi.
====================================================================
"""
        
        refinement_context = ""
        if original_script:
            refinement_context = f"""
=== SCRIPT ORIGINALE DA RIFINIRE ===
{original_script}

ISTRUZIONI DI RIFINITURA:
L'utente vuole modificare lo script sopra basandosi sul feedback fornito. 
Apporta le modifiche chirurgicamente mantenendo il senso originale ma applicando i cambiamenti richiesti (es. accorcia, cambia tono, ecc.).
====================================
"""

        # Each variation gets a completely different creative brief
        variation_directives = [
            {
                "hook_type": "DOMANDA PROVOCATORIA",
                "persona": "chi è frustrato e cerca una soluzione immediata",
                "tone": "diretto, quasi brutale nella verità",
                "opening": "Inizia con una domanda scomoda ma vera ('Quante volte hai...?' / 'Ti sei mai chiesto perché...')"
            },
            {
                "hook_type": "AFFERMAZIONE CONTRO-INTUITIVA",
                "persona": "chi ama sfidare le convinzioni comuni",
                "tone": "rivelatore, da insider che svela un segreto del settore",
                "opening": "Inizia contraddicendo una credenza comune ('Tutti ti dicono X. Ma la verità è Y.')"
            },
            {
                "hook_type": "MICRO-STORIA",
                "persona": "chi si identifica in una trasformazione personale",
                "tone": "caldo, umano, racconto tra amici",
                "opening": "Inizia con una storia in 2 secondi ('6 mesi fa...' / 'Una mia cliente mi ha detto...')"
            },
            {
                "hook_type": "DATO NUMERICO SORPRENDENTE",
                "persona": "chi ragiona su risultati concreti",
                "tone": "autorevole, da esperto che conosce i numeri",
                "opening": "Inizia con un numero o statistica inaspettata ('Il 73% delle persone che...')"
            },
            {
                "hook_type": "ERRORE COMUNE",
                "persona": "chi vuole evitare errori e cerca conferma",
                "tone": "educativo, empatico ma deciso",
                "opening": "Inizia dall'errore ('L'errore più comune che vedo è...' / 'Smetti di fare...')"
            }
        ]
        
        var = variation_directives[variation_index % len(variation_directives)]
        
        variation_block = ""
        if total_variations > 1:
            variation_block = f"""
═══ VARIAZIONE {variation_index + 1}/{total_variations} — BRIEF CREATIVO OBBLIGATORIO ═══
Tipo di Hook: {var['hook_type']}
Persona Target: {var['persona']}
Tono Specifico: {var['tone']}
Regola di Apertura: {var['opening']}

IMPORTANTE: Questo script DEVE differire completamente dalle altre variazioni nell'apertura, struttura e tono. Non usare lo stesso incipit delle altre versioni.
═══════════════════════════════════════════════════
"""

        # ── RAG DA NOTION ──
        # 1. Recupera i framework teorici attivi
        frameworks_rules = await notion_service.get_copy_frameworks()
        framework_context = f"\n=== REGOLE E FRAMEWORK OBBLIGATORI (Da rispettare tassativamente) ===\n{frameworks_rules}\n" if frameworks_rules else ""

        # 2. Recupera gli Script vincenti dal Vault Copy
        swipe_file_examples = await notion_service.get_vault_examples(NOTION_COPY_VAULT_DB_ID)
        swipe_context = f"\n=== ESEMPI GOLD STANDARD ('Swipe File') ===\nPrendi ispirazione e modella il tuo script basandoti sulla qualità e sullo stile di questi esempi vincenti del passato, ma NON copiarli letteralmente:\n{swipe_file_examples}\n" if swipe_file_examples else ""

        prompt = f"""SEI UN COPYWRITER ESPERTO DI VIDEO BREVI. Il tuo output sarà letto direttamente in camera.

REGOLA ASSOLUTA — LEGGI PRIMA DI TUTTO:
Scrivi ESCLUSIVAMENTE le parole che vengono dette nel video.
NON scrivere: "Ragionamento:", "Validazione:", "Note:", "Analisi:", "Framework:", commenti, spiegazioni, o qualsiasi testo che non sia lo script stesso.
Se scrivi qualcosa che non sono le parole del video, hai fallito.

{user_instructions}

ANGOLO: {angle['title']}
{angle.get('description', '')}

CONTESTO DI SUPPORTO (usa per dettagli e credibilità):
{research}

PREFERENZE E REGOLE:
- Tono: {preferences.get('tone', 'naturale e diretto')}
- Evita: {', '.join(preferences.get('avoid_words', [])) or 'nessuna'}
{feedback_context}
{user_instructions}
{framework_context}
{swipe_context}

{variation_block}

=== PROTOCOLLO OBBLIGATORIO: TRASMISSIONE DELLA QUALITÀ (CONCISIONE ESTREMA) ===
REGOLA ASSOLUTA: Trasmetti la qualità tramite dettagli concreti (Show, Don't Tell), ma DEVI essere chirurgico e veloce. Non stiamo scrivendo un film, ma uno script per un video da 20-30 secondi.
- NO (Assertivo/Pigro): "Abbiamo cibo di qualità." 
- NO (Verboso/Film): "Senti il profumo della brace che sale lenta mentre la croccantezza del carré appena servito delizia il palato." (TROPPO LUNGO)
- SÌ (Video Style): "Senti la croccantezza del carré appena uscito dalla brace." (VELOCE E PUNCHY)

STRUTTURA: Hook (2-3 sec) → Sviluppo (15-20 sec) → CTA (3-5 sec). Totale: 20-35 secondi parlati.
FORMATO: Paragrafi di 2-3 frasi separati da una riga vuota. Non scrivere ogni frase su una riga separata.{' Per il framework, scrivi il nome sezione in MAIUSCOLO come riga separata.' if script_instructions else ''}
STILE: Naturale come un vocale. Zero clichés. Zero "Scopri di più"."""

        messages = [{"role": "user", "content": prompt}]
        # Increase temperature per variation for genuine diversity
        temp = min(0.75 + (variation_index * 0.08), 1.0)
        return await self._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=temp)

    async def generate_deep_analysis(self, research_text: str, client_info: Dict[str, Any], target_vocabulary: List[str] = None) -> Dict[str, Any]:
        """Generates SWOT, buyer personas, tone, and strategy from research text."""
        vocab_context = f"\nVOCABOLARIO TARGET (Usa questi termini esatti): {', '.join(target_vocabulary)}\n" if target_vocabulary else ""
        
        prompt = f"""Sei un Senior Strategy Consultant specializzato in High-Ticket Sales e Direct Response Marketing.
        Trasforma questa ricerca di mercato in una strategia d'élite focalizzata sul POSIZIONAMENTO USB (Unicità Scientifica Biologica).

        RICERCA DI MERCATO:
        {research_text}

        {vocab_context}

        BUSINESS: {client_info.get('name', 'N/D')}

        --- LOGICA DI ANALISI ---
        1. SWOT: Focalizzata su dati reali e gap competitivi trovati nella ricerca.
        2. BUYER PERSONAS (JOB-TO-BE-DONE):
           - Usa il LINGUAGGIO REALE del target estratto dalle recensioni (vedi Vocabolario Target).
           - Perché desiderano la trasformazione? Cosa provano nel profondo (vergogna, ansia, desiderio di status)?
        3. TONO DI VOCE: Deve rispecchiare l'identità scientifica ma empatica. Fornisci DOs e DON'Ts basati su come il target vuole essere trattato.
        4. STRATEGIA: Un piano operativo di 3-6 mesi per dominare il mercato locale.

        NON includere "Obiettivi SMART" generici. Concentrati sul posizionamento e sulla comunicazione.

        Rispondi SOLO con un JSON valido.

        {{
          "swot": {{
            "strengths": "...",
            "weaknesses": "...",
            "opportunities": "...",
            "threats": "..."
          }},
          "buyer_personas": [
            {{
              "name": "Nome Cognome (Esemplificativo)",
              "type": "Etichetta Psicografica",
              "profile": "Lifestyle, budget, digital footprint...",
              "buying_habits": "Come decide l'acquisto",
              "fears": "Paure viscerali e obiezioni tecniche",
              "desires": "La trasformazione profonda ricercata",
              "critical_info": "Trigger mentali e parole 'killer' da usare"
            }}
          ],
          "tone": "Manuale del Tono di Voce specifico",
          "strategy": "Piano d'attacco basato sull'antagonismo ai competitor locali"
        }}"""
        
        messages = [{"role": "user", "content": prompt}]
        result = await self._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.5)
        
        # Extract JSON robustly
        fence = re.search(r'```(?:json)?\s*\n?(.*?)```', result, re.DOTALL)
        raw = fence.group(1).strip() if fence else result.strip()
        
        # Clean potential leading/trailing junk
        fb = raw.find('{')
        lb = raw.rfind('}')
        if fb != -1 and lb > fb:
            raw = raw[fb:lb+1]
        
        try:
            return json_repair.loads(raw)
        except Exception:
            # Fallback if parsing fails
            return {"raw_text": raw}

    async def generate_performance_report(self, client_info: Dict[str, Any], report_data: Dict[str, Any]) -> str:
        """Analyzes performance KPIs and generates a structured insights report."""
        kpi_lines = []
        for k, v in report_data.items():
            if k not in ("id", "created_at", "ai_report", "period_label"):
                kpi_lines.append(f"- {k}: {v}")
        kpi_text = "\n".join(kpi_lines)
        period = report_data.get("period_label", "periodo non specificato")

        prompt = f"""Sei un Performance Marketing Analyst senior. Analizza i seguenti dati di performance del cliente e produci un report strategico chiaro e azionabile.

CLIENTE: {client_info.get('name', 'N/D')}
PERIODO: {period}
OBIETTIVI: {client_info.get('objectives', 'Non specificati')}
STRATEGIA: {client_info.get('strategy', 'Non specificata')}

KPI E DATI:
{kpi_text}

Produci un report in Markdown con le seguenti sezioni:

## 📊 Sintesi Performance
Commento sintetico sui risultati principali (2-3 frasi).

## ✅ Cosa sta andando bene
- Bullet points con i punti di forza confermati dai dati

## ⚠️ Aree da migliorare
- Bullet points con problemi specifici e possibili cause

## 🎯 Prossimi passi consigliati
1. Azioni concrete e prioritizzate per il prossimo periodo
2. Con KPI target da raggiungere

## 💡 Insight strategico
Un'osservazione profonda che emergi dai dati, collegata agli obiettivi del cliente.

Sii diretto, specifico e usa i dati reali forniti. Evita genericità."""

        messages = [{"role": "user", "content": prompt}]
        return await self._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.5)

    async def sort_tasks(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """AI-powered task prioritization. Returns sorted task IDs + brief reasoning."""
        from datetime import datetime as dt
        today = dt.now().strftime("%Y-%m-%d")
        task_lines = []
        for t in tasks:
            parts = [f"ID: {t['id']}", f"Titolo: {t['title']}", f"Priorita: {t.get('priority','media')}", f"Stato: {t.get('status','todo')}"]
            if t.get("due_date"): parts.append(f"Scadenza: {t['due_date']}")
            if t.get("estimated_time"): parts.append(f"Tempo: {t['estimated_time']}")
            if t.get("client_name"): parts.append(f"Cliente: {t['client_name']}")
            if t.get("notes"): parts.append(f"Note: {t['notes'][:80]}")
            task_lines.append(" | ".join(parts))

        numbered = "\n".join(f"{i+1}. {line}" for i, line in enumerate(task_lines))
        prompt = f"""Sei un esperto di produttivita. Oggi e {today}.

Task aperte:
{numbered}

Criteri: urgenza (scadenza), impatto (priorita), velocita (tempo stimato), raggruppamento per cliente.

Rispondi SOLO con JSON:
{{
  "order": ["id1", "id2", ...],
  "reasoning": "Spiegazione 2-3 frasi",
  "quick_wins": ["id task sotto 30min"],
  "focus_tip": "Consiglio pratico per la giornata"
}}"""

        messages = [{"role": "user", "content": prompt}]
        result = await self._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.3)
        fence = re.search(r'```(?:json)?\s*\n?(.*?)```', result, re.DOTALL)
        raw = fence.group(1).strip() if fence else result.strip()
        fb = raw.find('{'); lb = raw.rfind('}')
        if fb != -1 and lb > fb:
            raw = raw[fb:lb+1]
        return json_repair.loads(raw)


    # ══════════════════════════════════════════════════════════
    #  COMPLETE ANALYSIS — Metodologia dalla guida
    # ══════════════════════════════════════════════════════════

    async def generate_complete_analysis(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        site_content: str = "",
        social_data: str = "",
        ads_data: str = "",
        raw_docs: str = "",
        google_reviews: str = "",
        instagram_comments: str = "",
        products_csv: str = "",
        services_txt: str = ""
    ) -> Dict[str, Any]:
        """
        🔥 NUOVO SISTEMA - Metodologia Francesco Agostinis

        Genera analisi strategica completa in 14 sezioni seguendo ESATTAMENTE
        i prompt della guida "Strategie Di Marketing Avanzate Con Gemini Per Meta Ads"

        Sostituisce completamente il vecchio sistema generico.
        """
        from .ai_service_strategic_analysis import generate_complete_strategic_analysis
        return await generate_complete_strategic_analysis(
            self, client_info, site_url, site_content, social_data, ads_data,
            raw_docs, google_reviews, instagram_comments, products_csv, services_txt
        )

ai_service = AIService()
