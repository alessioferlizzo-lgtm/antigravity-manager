"""
AIService - Complete Analysis Functions (Part 2)
Sezioni 6-12 dell'analisi completa
"""

import json
import json_repair
from typing import Dict, Any, List


async def generate_content_matrix(
    ai_service,
    customer_personas: List[Dict[str, Any]],
    product_portfolio: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    6. MATRICE STRATEGIA DEI CONTENUTI (Paid & Organic)
    Crea una tabella/matrice che collega le Personas a idee di contenuto concrete
    """

    personas_text = "\n\n".join([
        f"**{p.get('nome', '')}**: {p.get('chi_e', '')} | Problema: {p.get('problema_principale', '')}"
        for p in customer_personas
    ])

    products_text = json.dumps(product_portfolio, ensure_ascii=False, indent=2)

    prompt = f"""Ruolo: Agisci come un Content Strategist & Performance Marketer.

CUSTOMER PERSONAS:
{personas_text}

PRODOTTI:
{products_text}

Istruzioni: Crea una matrice strategica che collega ogni Persona identificata a strategie di contenuto concrete.

Per OGNI Persona (tutte e 10), genera:

1. HOOK PRINCIPALE
Una frase gancio (headline) che cattura l'attenzione di quel target specifico. Deve essere diretta, provocatoria o risonante. (Es: "Tratti le gambe peggio del viso?", "Mai più senza lamette", "Vorresti depilarti la metà delle volte?")

2. PAID ADS STRATEGY
Un'idea concreta per una creatività pubblicitaria su Meta/TikTok per quel target.
Focus su: quale angolo usare, tipo di visual, messaggio chiave
(Es: "Focus Ingredienti: Grafiche con nomi scientifici (Gymnema)", "Confronto montagna di usa-e-getta vs 1 rasoio durevole")

3. ORGANIC SOCIAL STRATEGY
Un'idea per contenuti social organici (Instagram/TikTok) per quel target.
Focus su: formato (reel, carosello, ASMR, educational), tipo di contenuto
(Es: "Education: 'Leggiamo l'INCI insieme'", "Lifestyle: Bathroom tour, ASMR visivo", "Comedy: Skit sul saltare la depilazione")

IMPORTANTE:
- Ogni strategia deve essere SPECIFICA e ACTIONABLE, non generica
- Usa il linguaggio e i pain points di quella precisa Persona
- Varia i formati e gli approcci tra le diverse Personas

Rispondi SOLO con JSON array:
[
  {{
    "icp_nome": "Nome Persona",
    "hook_principale": "Frase gancio pronta all'uso",
    "paid_ads_strategy": "Descrizione idea paid ads",
    "organic_social_strategy": "Descrizione idea organic"
  }}
]
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.7, max_tokens=16000)

    start = result_str.find("[")
    end = result_str.rfind("]") + 1
    if start != -1 and end > start:
        json_str = result_str[start:end]
        return json_repair.loads(json_str)
    return []


async def generate_product_vertical_analysis(
    ai_service,
    product_portfolio: Dict[str, Any],
    customer_personas: List[Dict[str, Any]],
    site_url: str
) -> List[Dict[str, Any]]:
    """
    7. ANALISI VERTICALE PRODOTTI
    Prompt dalla guida: "Generatore di Analisi Verticale Prodotti (E-Commerce)"
    Scheda dettagliata per ogni prodotto chiave
    """

    products_text = json.dumps(product_portfolio, ensure_ascii=False, indent=2)
    personas_names = ", ".join([p.get('nome', '') for p in customer_personas[:10]])

    prompt = f"""Ruolo: Agisci come un Product Marketing Manager esperto in cosmesi/food/retail. Il tuo obiettivo è analizzare tecnicamente ogni singolo prodotto e tradurre le caratteristiche tecniche in leve di marketing persuasive.

SITO: {site_url}

PORTAFOGLIO PRODOTTI:
{products_text}

PERSONAS IDENTIFICATE (usa per targetizzare):
{personas_names}

Istruzioni di Analisi: Per ogni prodotto principale (almeno i top 5-8 più importanti), estrai le informazioni tecniche e trasformale in vantaggi competitivi seguendo rigorosamente lo schema sottostante.

Output Richiesto: Genera una scheda per ogni prodotto analizzato, utilizzando la seguente struttura:

[NOME PRODOTTO] – [Categoria Sintetica]

ANALISI TECNICA & PUNTI DI FORZA:
- Materiali/Texture: Di cosa è fatto? (Es. Alluminio anodizzato, Texture Gel-to-Milk, Schiuma densa)
- Tecnologia/Innovazione: Ci sono brevetti o meccanismi particolari? (Es. RolaTek®, Crackling Technology)
- Ingredienti Chiave: Quali sono gli attivi principali e cosa fanno? (Es. Gymnema Sylvestre per ritardare la crescita, Tea Tree antibatterico)
- Accessori/Formato: Cosa è incluso o qual è il pack? (Es. Supporto magnetico, Pipetta contagocce)

STRATEGIA DI MARKETING:
- Reason to Buy (RTB): Elenca 3 motivi convincenti per acquistare, mixando logica ed emozione
  - Motivo 1: (Es. Risolve il disordine in doccia)
  - Motivo 2: (Es. Efficacia clinica o risparmio di tempo)
  - Motivo 3: (Es. Esperienza sensoriale unica)
- ICP (Target): Chi è il cliente ideale per questo specifico prodotto? Usa le Personas identificate
- Marketing Hooks (Ganci): Scrivi 3 headline pubblicitarie pronte all'uso (brevi, incisive, persuasive)
  - Hook 1 (Es. "Il primo rasoio che non vorrai nascondere.")
  - Hook 2 (Es. "Smetti di buttare plastica.")
  - Hook 3 (Es. "Gambe lisce come la seta in metà del tempo.")

IMPORTANTE:
- Usa DATI TECNICI REALI dal sito/catalogo
- Gli hooks devono essere copy-paste ready per le ads

Rispondi SOLO con JSON array:
[
  {{
    "nome_prodotto": "...",
    "categoria": "...",
    "analisi_tecnica": {{
      "materiali_texture": "...",
      "tecnologia_innovazione": "...",
      "ingredienti_chiave": ["...", "..."],
      "accessori_formato": "..."
    }},
    "strategia_marketing": {{
      "rtb": ["Motivo 1", "Motivo 2", "Motivo 3"],
      "icp_target": ["Persona 1", "Persona 2"],
      "marketing_hooks": ["Hook 1", "Hook 2", "Hook 3"]
    }}
  }}
]
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("perplexity/sonar-pro", messages, temperature=0.5, max_tokens=20000)

    start = result_str.find("[")
    end = result_str.rfind("]") + 1
    if start != -1 and end > start:
        json_str = result_str[start:end]
        return json_repair.loads(json_str)
    return []


async def generate_brand_voice(
    ai_service,
    site_url: str,
    social_data: str = "",
    ads_data: str = ""
) -> Dict[str, Any]:
    """
    8. BRAND VOICE & COMMUNICATION GUIDELINES
    Prompt dalla guida: "Brand Voice Decoder"
    Decodifica dell'ingegneria verbale del brand
    """

    social_context = f"""
📊 DATI SOCIAL (post, caption, risposte ai commenti):
{social_data}

ISTRUZIONI: Analizza il TONO esatto, le parole usate, le emoji, lo stile di formattazione.
""" if social_data else ""

    ads_context = f"""
📢 COPY DELLE ADS ATTIVE:
{ads_data}

ISTRUZIONI: Analizza il copywriting, il tono, le CTA, le parole chiave ricorrenti.
""" if ads_data else ""

    prompt = f"""Ruolo: Agisci come un Brand Linguist & Psicologo della Comunicazione. Il tuo compito non è solo descrivere "come scrive" il brand, ma analizzare PERCHÉ scrive così, decodificando le leve psicologiche e le scelte semantiche nascoste.

Input: Link al sito web (Home, Chi Siamo, FAQ, Pagine Prodotto): {site_url}

{social_context}
{ads_context}

Output Richiesto: Analizza i testi e genera una "Brand Voice & Communication Guideline" strutturata rigorosamente nei seguenti 6 moduli:

1. BRAND PERSONA & ARCHETIPI
Chi parla? Definisci la personalità come se fosse un essere umano.
Identifica il mix di archetipi di Jung (es. The Lover, The Everyman, The Sage, The Hero).
Posiziona il brand su una Matrice Tono di Voce: Divertente/Serio, Casuale/Formale, Irriverente/Rispettoso, Entusiasta/Distaccato.

2. I PILASTRI DELLA COMUNICAZIONE (The Rules)
Identifica le 3-4 regole inviolabili.
Cerca specificamente:
- Livello di inclusività (schwa ə, neutro, they)
- Gestione dell'ansia (come riducono lo stress dell'utente)
- Sensorialità delle descrizioni (tattile, olfattiva, visiva)
- Approccio educativo vs aspirazionale

3. ANALISI LINGUISTICA (Deep Dive)
Questa è la sezione tecnica. Analizza:
- Code-Switching (Itanglish, uso termini inglesi): quando e perché?
- Ristrutturazione Semantica: come rinominano concetti negativi in positivi (es. Depilazione → Rituale, Problema → Opportunità)
- Uso di metafore e analogie ricorrenti

4. GLOSSARIO DEL BRAND (Dictionary)
Crea una tabella "Invece di… Usa…" con almeno 5-8 coppie di termini chiave.
Es:
| Invece di… | Usa… |
| Cliente | Community / Friend |
| Compra | Unisciti / Scopri |
| Problema | Situazione / Sfida |

5. DOs & DON'Ts (Esempi Pratici)
Scrivi DUE esempi concreti in due versioni:
a) Descrizione prodotto: versione DON'T (noiosa/generica) vs DO (brandizzata)
b) Call to Action: versione DON'T (aggressiva) vs DO (amichevole)

6. STRUMENTI TATTICI
- Emoji Strategy: Quali sono le emoji firma del brand? (elenca le top 5-6 con spiegazione)
- Formattazione: Paragrafi corti? Elenchi puntati? Grassetti? Maiuscole?

IMPORTANTE:
- Usa CITAZIONI ESATTE dai testi analizzati per dimostrare ogni punto
- Zero genericità: "Tono amichevole" NON basta, servono esempi concreti

Rispondi SOLO con JSON:
{{
  "brand_persona": {{
    "descrizione": "Se il brand fosse una persona...",
    "archetipi": ["The Lover", "..."],
    "matrice_tov": {{
      "divertente_serio": "Verso dove pende (es: Giocoso ma con stile)",
      "casuale_formale": "...",
      "irriverente_rispettoso": "...",
      "entusiasta_distaccato": "..."
    }}
  }},
  "pilastri_comunicazione": [
    {{
      "nome": "Es: Inclusività Radicale",
      "descrizione": "...",
      "regola_aurea": "...",
      "esempio": "Citazione esatta"
    }}
  ],
  "analisi_linguistica": {{
    "code_switching": "Quando e perché usa termini inglesi",
    "ristrutturazione_semantica": "Come rinomina concetti negativi",
    "metafore_ricorrenti": ["...", "..."]
  }},
  "glossario": [
    {{
      "invece_di": "Cliente",
      "usa": "Community / Friend",
      "perche": "Breve spiegazione"
    }}
  ],
  "dos_donts": [
    {{
      "scenario": "Descrizione prodotto",
      "dont": "Esempio noioso",
      "do": "Esempio brandizzato"
    }}
  ],
  "strumenti_tattici": {{
    "emoji_strategy": [
      {{
        "emoji": "❤️",
        "uso": "Quando e perché"
      }}
    ],
    "formattazione": "Descrizione stile formattazione"
  }}
}}
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.6, max_tokens=20000)
    return json_repair.loads(result_str)


async def generate_objections_management(
    ai_service,
    site_url: str,
    brand_voice: Dict[str, Any],
    product_portfolio: Dict[str, Any]
) -> Dict[str, Any]:
    """
    9. GESTIONE OBIEZIONI
    Prompt dalla guida: "Generatore di Script Gestione Obiezioni (CX & Sales Psychology)"
    """

    voice_tov = brand_voice.get('brand_persona', {}).get('matrice_tov', {})
    products_text = json.dumps(product_portfolio, ensure_ascii=False, indent=2)[:2000]

    prompt = f"""Ruolo: Agisci come Head of Customer Experience (CX) & Psicologo comportamentale. Il tuo obiettivo è analizzare il business model e i prodotti del sito fornito per anticipare le critiche dei clienti e creare risposte ("Script") empatiche, persuasive e risolutive.

Input: Link al sito web: {site_url}

PRODOTTI:
{products_text}

TONO DI VOCE DEL BRAND (da rispettare negli script):
{json.dumps(voice_tov, ensure_ascii=False, indent=2)}

Istruzioni: Analizza i prezzi, le politiche di spedizione/reso, la tipologia di prodotto (se ricorrente/abbonamento o acquisto singolo) e le pagine "Chi Siamo" o "Sostenibilità". Sulla base di ciò, crea un Modulo Operativo di Gestione Obiezioni diviso nelle seguenti 5 sezioni.

Output Richiesto: Per ogni sezione, crea una lista di obiezioni con 3 elementi:

1. Cosa dice l'Utente: L'obiezione tipica (sii brutale e realistico)
2. Script di Risposta: La risposta pronta all'uso (Tone of Voice: Empatico, Chiaro, rassicurante, uso di Emoji se in linea col brand)
3. Angolo Psicologico: Spiega perché questa risposta funziona (es. Reframing, Risk Reversal, Riprova Sociale)

Le 5 Sezioni da coprire:

1. OBIEZIONI SUL PREZZO E VALORE
Costo, confronto con alternative economiche, spedizione.

2. OBIEZIONI SULLA MECCANICA (Abbonamento/Impegno)
Paura dell'impegno, difficoltà di disdetta, "è una trappola?".

3. OBIEZIONI SUL PRODOTTO (Performance)
Dubbi su efficacia, qualità o utilizzo.

4. OBIEZIONI SU ETICA E SOSTENIBILITÀ
Greenwashing, materiali, packaging.

5. FORMATI DI RISPOSTA (Social vs Email)
Adatta uno script per: commento Instagram (max 2 frasi) vs Email supporto (strutturata)

IMPORTANTE:
- Sii SPECIFICO per questo brand, non generico
- Gli script devono essere COPY-PASTE READY
- Usa il tono di voce del brand

Rispondi SOLO con JSON:
{{
  "obiezioni_prezzo": [
    {{
      "obiezione": "Costa troppo!",
      "script_risposta": "Script empatico pronto",
      "angolo_psicologico": "Reframing / Risk Reversal / ecc"
    }}
  ],
  "obiezioni_meccanica": [...],
  "obiezioni_prodotto": [...],
  "obiezioni_etica": [...],
  "formati_risposta": {{
    "esempio_social": "Script corto per Instagram",
    "esempio_email": "Script lungo per email supporto"
  }}
}}
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.6, max_tokens=16000)
    return json_repair.loads(result_str)


async def generate_reviews_analysis(
    ai_service,
    social_data: str = "",
    google_reviews: str = "",
    instagram_comments: str = ""
) -> Dict[str, Any]:
    """
    10. ANALISI RECENSIONI (Voice of Customer)
    Prompt dalla guida: "Analisi Voice of Customer (Review Mining)"
    """

    reviews_data = ""
    if google_reviews:
        reviews_data += f"RECENSIONI GOOGLE:\n{google_reviews}\n\n"
    if instagram_comments:
        reviews_data += f"COMMENTI INSTAGRAM:\n{instagram_comments}\n\n"
    if social_data:
        reviews_data += f"ALTRI DATI SOCIAL:\n{social_data}\n\n"

    if not reviews_data:
        return {
            "golden_hooks": [],
            "pain_points": [],
            "keywords_ricorrenti": [],
            "conclusione": "Nessun dato di recensioni disponibile per l'analisi."
        }

    prompt = f"""Ruolo: Agisci come un Direct Response Copywriter e Customer Insight Analyst. Il tuo compito è analizzare le recensioni e il feedback dei clienti per estrarre angoli di marketing ad alta conversione e strategie di gestione delle obiezioni.

Input: Qui sotto ti fornisco recensioni e feedback reali:

{reviews_data}

Istruzioni: Analizza il linguaggio esatto usato dai clienti. Non riassumere genericamente; cerca pattern specifici, frasi ricorrenti e lamentele tecniche. Genera un report strategico diviso nelle seguenti 4 sezioni.

Output Richiesto:

1. I "GANCI" D'ORO (GOLDEN HOOKS — da recensioni/commenti positivi)
Identifica 5 concetti chiave ripetuti nei feedback positivi.
Per ognuno:
- Cita la FRASE ESATTA ("Verbatim") usata dal cliente
- Trasformala in una HEADLINE pubblicitaria pronta all'uso ("The Hook")

Esempio:
- Verbatim: "Basta una passata e non un graffio."
- Hook: "La prova della 'passata singola'. Taglia tutto al primo colpo."

2. I PUNTI DOLENTI & LEVE DI CONTRO-ATTACCO (da recensioni/commenti negativi)
Analizza le critiche. Per ogni problema identificato:
- Definisci il problema
- Leva educativa per risolverlo
- Copy risolutivo (es. "Il segreto per X è...")

3. KEYWORDS RICORRENTI (SEO & Copy)
Elenca le 10 parole/aggettivi più frequenti nei feedback.
(Es: "delicato", "solido", "comodo", "profumato", ecc.)

4. CONCLUSIONE PRATICA & AZIONE
- Identikit del fan (chi ama di più questo brand?)
- Azione post-acquisto concreta da implementare (es. email con tips, video tutorial)

IMPORTANTE:
- Usa CITAZIONI LETTERALI, non parafrasare
- Distingui tra pattern positivi (da amplificare) e negativi (da risolvere)

Rispondi SOLO con JSON:
{{
  "golden_hooks": [
    {{
      "verbatim": "Frase esatta dal cliente",
      "hook": "Headline pubblicitaria pronta"
    }}
  ],
  "pain_points": [
    {{
      "problema": "Descrizione problema",
      "leva_educativa": "Come risolverlo",
      "copy_risolutivo": "Frase/script pronto"
    }}
  ],
  "keywords_ricorrenti": ["parola1", "parola2", "..."],
  "conclusione": {{
    "identikit_fan": "Descrizione cliente ideale basata sui dati",
    "azione_post_acquisto": "Azione concreta consigliata"
  }}
}}
"""

    messages = [{"role": "user", "content": prompt}]
    result_str = await ai_service._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.6, max_tokens=16000)
    return json_repair.loads(result_str)
