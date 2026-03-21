"""
AIService - Complete Analysis Functions (Part 3 - Final)
Sezioni 11-12 dell'analisi completa
"""

import json
import json_repair
from typing import Dict, Any, List


async def generate_competitor_battlecards(
    ai_service,
    client_info: Dict[str, Any],
    site_url: str,
    brand_identity: Dict[str, Any],
    brand_values: Dict[str, Any],
    product_portfolio: Dict[str, Any]
) -> Dict[str, Any]:
    """
    11. BATTLECARDS COMPETITOR
    Prompt dalla guida: "Generatore di Battlecards & Posizionamento Competitivo"
    """

    client_name = client_info.get('name', '')
    competitors = client_info.get('competitors', [])

    competitors_text = ""
    if competitors:
        for comp in competitors:
            if isinstance(comp, dict):
                comp_name = comp.get('name', '')
                comp_links = comp.get('links', [])
                competitors_text += f"- {comp_name}: {json.dumps(comp_links)}\n"
            else:
                competitors_text += f"- {str(comp)}\n"

    context = f"""
BRAND: {client_name}
SITO: {site_url}

COMPETITOR NOTI:
{competitors_text if competitors_text else "Nessun competitor specifico fornito — cerca competitor nel settore"}

IDENTITÀ BRAND:
{json.dumps(brand_identity, ensure_ascii=False, indent=2)}

VALORI BRAND:
{json.dumps(brand_values, ensure_ascii=False, indent=2)}

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False, indent=2)[:3000]}
"""

    prompt = f"""{context}

Ruolo: Agisci come Consulente Strategico di Posizionamento. Devi analizzare il brand, capire chi sono i veri competitor (anche se non citati) e creare una guida pratica per vincere il confronto.

Istruzioni: Analizza la proposta di valore (Prezzo, Design, Ingredienti, Messaggio). Identifica 4 categorie di competitor e crea per ognuno una "Battlecard" seguendo questo schema.

Output Richiesto:

1. NOI vs IL COMPETITOR DIRETTO ("Il Gemello")
Il brand online/fisico più simile. Trova cosa manca a loro e qual è la nostra mossa vincente.
- Chi sono
- Punto di Forza (cosa fanno bene)
- Il Punto Debole (dove possiamo attaccarli)
- La Nostra Mossa (come differenziarci)
- Script Risposta (frase pronta quando il cliente nomina questo competitor)

2. NOI vs IL GIGANTE RETAIL ("Il Comodo")
L'opzione da supermercato/Amazon/catena nazionale. Smonta il mito del risparmio.
- Chi sono
- Punto di Forza
- Il Punto Debole
- La Nostra Mossa
- Script Risposta

3. NOI vs L'ABITUDINE SEGRETA / SOSTITUTO
Il prodotto usato male (es. rasoio uomo per donna, pasto veloce vs ristorante). Spiega perché non va bene.
- Chi sono
- Punto di Forza
- Il Punto Debole
- La Nostra Mossa
- Script Risposta

4. NOI vs LA SOLUZIONE DEFINITIVA ("L'Alternativa")
La soluzione drastica/costosa (es. Laser per depilazione, chirurgia per estetica, stellato per ristorazione). Posizionati come complementare, non nemico.
- Chi sono
- Punto di Forza
- Il Punto Debole
- La Nostra Mossa
- Script Risposta

5. CHEAT SHEET: Tabella con frasi secche per chiudere il confronto
Se il cliente nomina X → Rispondi così

6. IDEE ADS: 2 spunti visivi per pubblicità comparative

IMPORTANTE:
- Sii SPECIFICO: identifica competitor REALI per nome, non "competitor generico"
- Gli script devono essere COPY-PASTE READY, col tono di voce del brand
- Se non riesci a identificare competitor in una categoria, scrivi "Non applicabile a questo settore"

Rispondi SOLO con JSON:
{{
  "competitor_diretto": {{
    "chi_sono": "Nome e descrizione",
    "punto_forza": "...",
    "punto_debole": "...",
    "nostra_mossa": "...",
    "script_risposta": "Frase pronta"
  }},
  "gigante_retail": {{...}},
  "abitudine_sostituto": {{...}},
  "soluzione_definitiva": {{...}},
  "cheat_sheet": [
    {{
      "se_nomina": "Nome competitor",
      "rispondi": "Script breve"
    }}
  ],
  "idee_ads_comparative": [
    {{
      "titolo": "Idea ads 1",
      "descrizione": "Descrizione visual e copy"
    }}
  ]
}}
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("perplexity/sonar-pro", messages, temperature=0.6, max_tokens=16000)
    return json_repair.loads(result_str)


async def generate_seasonal_roadmap(
    ai_service,
    client_info: Dict[str, Any],
    product_portfolio: Dict[str, Any],
    customer_personas: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    12. ROADMAP STAGIONALE
    Prompt dalla guida: "Generatore di Roadmap Stagionale"
    """

    client_name = client_info.get('name', '')
    industry = client_info.get('metadata', {}).get('industry', 'settore non specificato')
    products_text = json.dumps(product_portfolio, ensure_ascii=False, indent=2)[:3000]
    personas_names = ", ".join([p.get('nome', '') for p in customer_personas[:10]])

    prompt = f"""Ruolo: Agisci come Head of Growth. Analizza il catalogo prodotti e costruisci un piano mensile per massimizzare le vendite sfruttando stagionalità e psicologia d'acquisto.

CLIENTE: {client_name}
SETTORE: {industry}

PRODOTTI:
{products_text}

PERSONAS TARGET:
{personas_names}

Istruzioni: Dividi l'anno in 4 fasi logiche (Q1-Q4) e crea un piano strategico mensile sfruttando stagionalità, festività, comportamenti d'acquisto.

Le 4 Fasi dell'Anno:

Q1 (Gen-Mar): RECOVERY & BUONI PROPOSITI
Tema: Detox post-feste, nuovi inizi, routine, cura di sé
Obiettivo: Tenere attivi i clienti anche in bassa stagione, sfruttare "nuovo anno nuova me"

Q2 (Apr-Giu): PREPARAZIONE PRE-ESTATE
Tema: Gambe scoperte, prova costume, vacanze in arrivo, voglia di rinnovarsi
Obiettivo: Acquisizione di nuovi clienti prima del picco

Q3 (Lug-Set): PEAK / LIFESTYLE
Tema: Vacanze, viaggi, caldo, esposizione sociale, energia estiva
Obiettivo: Alzare lo scontrino medio, vendere prodotti lifestyle/premium

Q4 (Ott-Dic): MONETIZZAZIONE & GIFTING
Tema: Black Friday, Natale, regali, coccole autunnali, preparazione inverno
Obiettivo: Fare cassa con promo strategiche e regalistica

Output Richiesto: Crea una roadmap con almeno 8-12 mesi chiave (minimo 2 mesi per trimestre) con:

- MESE & TEMA: Il concetto creativo del mese
- PRODOTTO HERO: Quale prodotto spingere (non "tutto", scegli UNA priorità)
- STRATEGIA: Tipo di promo, bundle, angolo d'attacco
- TARGET: A quale Persona parliamo questo mese
- HOOK & CONTENT: Una headline pronta + un'idea video/post concreta

ESEMPIO (da adattare al tuo brand):
| Mese | Tema | Prodotto Hero | Strategia | Target | Hook & Content |
| Gennaio | Skin Detox | Scrub corpo | Bundle "Restart Kit" | Skincare Intellectual | "I tuoi peli sono in letargo? La tua pelle no." — Video ASMR dello scrub |

Bonus: Aggiungi 3 consigli tattici di esecuzione
(es. "Regola del Meteo": quando fa caldo spingi prodotti rinfrescanti, quando fa freddo prodotti comfort)

IMPORTANTE:
- Adatta la roadmap al SETTORE specifico (beauty ha stagionalità diversa da food)
- Ogni mese deve avere un focus CHIARO e ACTIONABLE
- Gli hooks devono essere copy-ready

Rispondi SOLO con JSON:
{{
  "q1_recovery": [
    {{
      "mese": "Gennaio",
      "tema": "...",
      "prodotto_hero": "...",
      "strategia": "...",
      "target_persona": "...",
      "hook": "...",
      "content_idea": "..."
    }}
  ],
  "q2_preparazione": [...],
  "q3_peak": [...],
  "q4_monetizzazione": [...],
  "consigli_tattici": [
    "Consiglio 1: Regola del meteo — ...",
    "Consiglio 2: ...",
    "Consiglio 3: ..."
  ]
}}
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.7, max_tokens=20000)
    return json_repair.loads(result_str)


async def generate_complete_analysis_orchestrator(
    ai_service,
    client_info: Dict[str, Any],
    site_url: str,
    social_data: str = "",
    ads_data: str = "",
    raw_docs: str = "",
    google_reviews: str = "",
    instagram_comments: str = ""
) -> Dict[str, Any]:
    """
    ORCHESTRATOR: Genera tutte le 12 sezioni dell'analisi completa
    Chiama tutte le funzioni in sequenza e raccoglie i risultati
    """
    from .ai_service_complete_analysis import CompleteAnalysisService
    from . import ai_service_complete_analysis_part2 as part2
    from . import ai_service_complete_analysis_part3 as part3

    service = CompleteAnalysisService(ai_service)

    print("🔄 Generazione analisi completa: Step 1/12 - Brand Identity...")
    brand_identity = await service.generate_brand_identity(
        client_info, site_url, social_data, raw_docs, ads_data
    )

    print("🔄 Step 2/12 - Brand Values...")
    brand_values = await service.generate_brand_values(
        client_info, site_url, social_data, raw_docs
    )

    print("🔄 Step 3/12 - Product Portfolio...")
    product_portfolio = await service.generate_product_portfolio(
        client_info, site_url, raw_docs
    )

    print("🔄 Step 4/12 - Reasons to Buy...")
    reasons_to_buy = await service.generate_reasons_to_buy(
        client_info, brand_identity, product_portfolio, brand_values
    )

    print("🔄 Step 5/12 - Customer Personas...")
    customer_personas = await service.generate_customer_personas(
        client_info, brand_identity, product_portfolio, social_data, ads_data
    )

    print("🔄 Step 6/12 - Content Matrix...")
    content_matrix = await part2.generate_content_matrix(
        ai_service, customer_personas, product_portfolio
    )

    print("🔄 Step 7/12 - Product Vertical Analysis...")
    product_vertical = await part2.generate_product_vertical_analysis(
        ai_service, product_portfolio, customer_personas, site_url
    )

    print("🔄 Step 8/12 - Brand Voice...")
    brand_voice = await part2.generate_brand_voice(
        ai_service, site_url, social_data, ads_data
    )

    print("🔄 Step 9/12 - Objections Management...")
    objections = await part2.generate_objections_management(
        ai_service, site_url, brand_voice, product_portfolio
    )

    print("🔄 Step 10/12 - Reviews Analysis (Voice of Customer)...")
    reviews_voc = await part2.generate_reviews_analysis(
        ai_service, social_data, google_reviews, instagram_comments
    )

    print("🔄 Step 11/12 - Competitor Battlecards...")
    battlecards = await part3.generate_competitor_battlecards(
        ai_service, client_info, site_url, brand_identity, brand_values, product_portfolio
    )

    print("🔄 Step 12/12 - Seasonal Roadmap...")
    seasonal_roadmap = await part3.generate_seasonal_roadmap(
        ai_service, client_info, product_portfolio, customer_personas
    )

    print("✅ Analisi completa generata con successo!")

    return {
        "brand_identity": brand_identity,
        "brand_values": brand_values,
        "product_portfolio": product_portfolio,
        "reasons_to_buy": reasons_to_buy,
        "customer_personas": customer_personas,
        "content_matrix": content_matrix,
        "product_vertical": product_vertical,
        "brand_voice": brand_voice,
        "objections": objections,
        "reviews_voc": reviews_voc,
        "battlecards": battlecards,
        "seasonal_roadmap": seasonal_roadmap
    }
