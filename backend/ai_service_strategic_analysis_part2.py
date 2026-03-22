"""
Sistema di Analisi Strategica Completa - PARTE 2
Sezioni 4-14 seguendo metodologia Francesco Agostinis
"""

import json
from typing import Dict, Any, List

# Import Instagram formatter dal modulo principale
from .ai_service_strategic_analysis import format_instagram_data


async def generate_reasons_to_buy(
    ai_service,
    client_info: Dict[str, Any],
    brand_identity: Dict[str, Any],
    brand_values: Dict[str, Any],
    product_portfolio: Dict[str, Any]
) -> Dict[str, Any]:
    """
    SEZIONE 4: REASONS TO BUY (RTB)

    Distingue le motivazioni di acquisto in due categorie:
    - RTB Razionali (Logica): Efficacia, convenienza, risparmio tempo
    - RTB Emotive (Cuore): Valori etici, joy of use, self-care, appartenenza
    """

    client_name = client_info.get("name", "")

    system_prompt = f"""Agisci come un Consumer Psychologist & Direct Response Copywriter.

Analizza {client_name} e identifica le REASONS TO BUY (Motivazioni di Acquisto) dividendole in due categorie.

CONTESTO BRAND:
{json.dumps(brand_identity, ensure_ascii=False)[:2000]}

VALORI:
{json.dumps(brand_values, ensure_ascii=False)[:1500]}

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False)[:2000]}

OUTPUT RICHIESTO:

### RTB RAZIONALI (Logica - La Testa)
Motivazioni basate su FATTI, DATI, CONVENIENZA:
- Efficacia tecnica comprovata
- Convenienza economica (abbonamenti, bundle, risparmio)
- Risparmio di tempo
- Soluzioni a problemi pratici specifici
- Garanzie, certificazioni, prove

### RTB EMOTIVE (Cuore - Le Emozioni)
Motivazioni basate su EMOZIONI, VALORI, IDENTITÀ:
- Valori etici e morali (sostenibilità, inclusività)
- "Joy of Use" - esperienza sensoriale piacevole
- Estetica e design (orgoglio di possesso)
- Self-care e coccola personale
- Appartenenza a una community/tribù
- Status e trasformazione identitaria

Per ogni RTB fornisci:
1. Nome RTB
2. Descrizione dettagliata
3. Evidenza concreta (da prodotti/valori)
4. Headline di marketing pronta all'uso

Rispondi SOLO con JSON:
{{
  "rational_rtb": [
    {{
      "name": "Nome RTB razionale",
      "description": "Descrizione dettagliata",
      "evidence": "Evidenza concreta",
      "marketing_hook": "Headline pronta"
    }}
  ],
  "emotional_rtb": [
    {{
      "name": "Nome RTB emotivo",
      "description": "Descrizione dettagliata",
      "evidence": "Evidenza concreta",
      "marketing_hook": "Headline pronta"
    }}
  ]
}}

REGOLE:
✅ Almeno 3-4 RTB per categoria
✅ Sii specifico - no genericità
✅ Basati SOLO sui dati forniti"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.3,
            max_tokens=3000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"rational_rtb": [], "emotional_rtb": [], "raw_text": response}

    except Exception as e:
        print(f"Errore generazione Reasons to Buy: {e}")
        return {"rational_rtb": [], "emotional_rtb": [], "error": str(e)}


async def generate_customer_personas(
    ai_service,
    client_info: Dict[str, Any],
    site_content: str,
    brand_identity: Dict[str, Any],
    product_portfolio: Dict[str, Any],
    social_data: str = "",
    ads_data: str = "",
    google_reviews: str = ""
) -> List[Dict[str, Any]]:
    """
    SEZIONE 5: LE 10 IDEAL CUSTOMER PERSONAS (ICP)

    Estrapola 10 profili di clienti ideali molto specifici.
    Per ogni persona: Nome evocativo, Problema, Desiderio, Profilo psicografico
    """

    client_name = client_info.get("name", "")

    # 🔥 FORMATTA DATI INSTAGRAM
    instagram_formatted = format_instagram_data(social_data) if social_data else "Dati Instagram non disponibili"

    system_prompt = f"""Agisci come un Customer Intelligence Analyst esperto in segmentazione psicografica.

Crea 10 IDEAL CUSTOMER PERSONAS (ICP) MOLTO SPECIFICHE per {client_name}.

BRAND IDENTITY:
{json.dumps(brand_identity, ensure_ascii=False)[:1500]}

PRODOTTI/SERVIZI:
{json.dumps(product_portfolio, ensure_ascii=False)[:2000]}

{instagram_formatted}

DATI ADS:
{ads_data[:1500] if ads_data else "Non disponibili"}

📝 RECENSIONI GOOGLE (Voice of Customer):
{google_reviews[:2000] if google_reviews else "Non disponibili"}

IMPORTANTE: Usa le recensioni Google per identificare:
- Problemi reali espressi dai clienti
- Linguaggio esatto che usano (Voice of Customer)
- Desideri e aspirazioni
- Pain points specifici
- Quote verbatim autentiche

ISTRUZIONI:
Per ogni Persona crea un NOME EVOCATIVO (es. "Skincare Intellectual", "Aesthetic Curator", "Busy Professional").

Per ognuna definisci:

1. **Chi è** (età, occupazione, stile di vita)
2. **Problema Principale** - La frustrazione o dolore specifico
3. **Desiderio Profondo** - Cosa vuole davvero ottenere
4. **Comportamento di Acquisto** - Come decide, cosa valuta
5. **Prodotti Ideali** - Quali prodotti del portfolio sono perfetti per lei/lui
6. **Quote Verbatim** - Come parlerebbe questa persona (es. "Viso che cade", "Non ho tempo")

Esempi di personas:
- "Skincare Intellectual" - legge l'INCI, vuole attivi scientifici
- "Aesthetic Curator" - vuole prodotti belli da vedere
- "Sensitive Skin Sufferer" - soffre di irritazioni/follicolite
- "Busy Professional" - cerca automazione e risparmio tempo
- "Values-Driven" - compra etico, sostenibile, inclusivo
- "Eco-Conscious" - riduce plastica senza perdere qualità
- "Trend Follower" - cerca viralità, novità, ASMR
- "Gift Giver" - cerca regali curati
- "Problem Solver" - ha un problema specifico da risolvere

Rispondi SOLO con JSON:
{{
  "personas": [
    {{
      "persona_name": "Nome Evocativo",
      "who": "Chi è (età, occupazione, lifestyle)",
      "main_problem": "Problema principale specifico",
      "deep_desire": "Desiderio profondo",
      "buying_behavior": "Come decide di acquistare",
      "ideal_products": ["Prodotto 1", "Prodotto 2"],
      "verbatim_quotes": ["Quote 1", "Quote 2"]
    }}
  ]
}}

REGOLE:
✅ Esattamente 10 personas
✅ Nomi creativi e memorabili
✅ SPECIFICI - no genericità
✅ Basati sui prodotti e valori reali"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",  # Claude migliore per creatività personas
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.4,
            max_tokens=5000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return data.get("personas", [])
        else:
            return []

    except Exception as e:
        print(f"Errore generazione Customer Personas: {e}")
        return []


async def generate_content_matrix(
    ai_service,
    customer_personas: List[Dict[str, Any]],
    product_portfolio: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    SEZIONE 6: MATRICE STRATEGIA DEI CONTENUTI (Paid & Organic)

    Collega le Personas a idee di contenuto concrete.
    Per ogni ICP: Hook Principale, Paid Ads Strategy, Organic Social Strategy
    """

    system_prompt = f"""Agisci come un Content Strategist & Media Buyer esperto.

Crea una MATRICE STRATEGICA DEI CONTENUTI che collega ogni Persona a strategie concrete.

PERSONAS:
{json.dumps(customer_personas, ensure_ascii=False)[:3000]}

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False)[:2000]}

Per OGNI Persona crea:

1. **HOOK PRINCIPALE** - Una frase gancio (headline) che cattura l'attenzione di quel target specifico
2. **PAID ADS STRATEGY** (Meta/TikTok) - Un'idea concreta per una creatività pubblicitaria
   - Es. "Focus ingredienti con grafiche scientifiche"
   - Es. "UGC testimonianze su follicolite"
   - Es. "Confronto prima/dopo"
3. **ORGANIC SOCIAL STRATEGY** - Un'idea per contenuti social organici
   - Es. "Routine ASMR"
   - Es. "Educational: leggiamo l'INCI insieme"
   - Es. "Bathroom tour lifestyle"

Rispondi SOLO con JSON:
{{
  "content_matrix": [
    {{
      "persona_name": "Nome Persona",
      "hook_principale": "Frase gancio potente",
      "paid_ads_idea": "Idea creativa pubblicitaria specifica",
      "organic_social_idea": "Idea contenuto organico specifico",
      "rationale": "Perché questa strategia funziona per questa persona"
    }}
  ]
}}

REGOLE:
✅ Idee CONCRETE e actionable
✅ Specifiche per ogni persona
✅ Mix di formati (video, carosello, UGC, educational)"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.4,
            max_tokens=4000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return data.get("content_matrix", [])
        else:
            return []

    except Exception as e:
        print(f"Errore generazione Content Matrix: {e}")
        return []


async def generate_brand_voice(
    ai_service,
    client_info: Dict[str, Any],
    site_content: str,
    social_data: str = ""
) -> Dict[str, Any]:
    """
    SEZIONE 8: BRAND VOICE & COMMUNICATION GUIDELINES

    Decodifica l'identità verbale del brand.
    Analizza: Archetipi, Pilastri Comunicazione, Analisi Linguistica, Glossario, DO/DON'T
    """

    client_name = client_info.get("name", "")

    # 🔥 FORMATTA DATI INSTAGRAM
    instagram_formatted = format_instagram_data(social_data) if social_data else "Dati Instagram non disponibili"

    system_prompt = f"""Agisci come un Brand Linguist & Psicologo della Comunicazione.

Analizza il linguaggio di {client_name} e crea le BRAND VOICE & COMMUNICATION GUIDELINES.

CONTENUTO SITO:
{site_content[:5000]}

{instagram_formatted}

OUTPUT RICHIESTO:

### 1. BRAND PERSONA & ARCHETIPI
- Se il brand fosse una persona, chi sarebbe?
- Mix di archetipi di Jung (es. The Lover + The Everyman)
- Matrice Tono di Voce: Divertente/Serio, Casuale/Formale, Irriverente/Rispettoso

### 2. PILASTRI COMUNICAZIONE (3-4 regole inviolabili)
Es:
- Inclusività Radicale (schwa, neutro)
- Stress-Free & Empatico
- Aesthetic & Sensoriale
- Diretto & Gen Z Native

### 3. ANALISI LINGUISTICA
- Code-Switching (Itanglish): perché usa termini inglesi?
- Ristrutturazione Semantica: come rinomina concetti negativi in positivi
  (es. "Depilazione" → "Rituale")

### 4. GLOSSARIO DEL BRAND
Tabella "Invece di... → Usa..."
Es: "Clienti" → "Community", "Compra" → "Unisciti", etc.

### 5. DO/DON'T PRATICI
Esempio di copy in versione SBAGLIATA e versione CORRETTA

### 6. EMOJI STRATEGY
Quali emoji usa il brand? Quali sono firma?

Rispondi SOLO con JSON:
{{
  "brand_persona": "Descrizione persona",
  "archetypes": ["Archetipo 1", "Archetipo 2"],
  "tone_matrix": {{
    "playful_serious": "Dove si posiziona",
    "casual_formal": "Dove si posiziona",
    "irreverent_respectful": "Dove si posiziona"
  }},
  "communication_pillars": [
    {{
      "name": "Nome pilastro",
      "description": "Descrizione",
      "example": "Esempio pratico"
    }}
  ],
  "linguistic_analysis": {{
    "code_switching": "Analisi uso inglese/italiano",
    "semantic_reframing": {{"Negativo": "Positivo"}}
  }},
  "brand_glossary": {{"Invece di": "Usa"}},
  "do_dont_examples": [
    {{
      "scenario": "Scenario",
      "dont": "Versione sbagliata",
      "do": "Versione corretta"
    }}
  ],
  "emoji_strategy": ["emoji1", "emoji2"]
}}"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.3,
            max_tokens=4000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"raw_text": response}

    except Exception as e:
        print(f"Errore generazione Brand Voice: {e}")
        return {"error": str(e)}
