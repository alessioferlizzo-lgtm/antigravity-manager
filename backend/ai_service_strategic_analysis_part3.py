"""
Sistema di Analisi Strategica Completa - PARTE 3
Sezioni finali seguendo metodologia Francesco Agostinis
"""

import json
from typing import Dict, Any, List


async def generate_objections_management(
    ai_service,
    client_info: Dict[str, Any],
    product_portfolio: Dict[str, Any],
    brand_values: Dict[str, Any],
    site_content: str
) -> Dict[str, Any]:
    """
    SEZIONE 9: GESTIONE OBIEZIONI

    Script di risposta per obiezioni comuni:
    - Prezzo e Valore
    - Abbonamento (se applicabile)
    - Efficacia Prodotto
    - Etica e Sostenibilità
    """

    client_name = client_info.get("name", "")

    system_prompt = f"""Agisci come Head of Customer Experience & Psicologo comportamentale.

Analizza {client_name} e crea SCRIPT DI GESTIONE OBIEZIONI.

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False)[:2000]}

VALORI:
{json.dumps(brand_values, ensure_ascii=False)[:1500]}

SITO:
{site_content[:3000]}

Crea script per 4 categorie di obiezioni:

### 1. OBIEZIONI SUL PREZZO E VALORE
Es: "Costa troppo", "Spedizione cara", "Su Amazon costa meno"

### 2. OBIEZIONI SULLA MECCANICA
Es: "È una trappola?", "Ho troppe scorte", "Posso comprare senza abbonamento?"

### 3. OBIEZIONI SU PRODOTTO/EFFICACIA
Es: "Uso già quello del mio partner", "È una truffa, non funziona", "Mi sono tagliata/irritata lo stesso"

### 4. OBIEZIONI SU ETICA/SOSTENIBILITÀ
Es: "È greenwashing?", "È davvero cruelty-free?", "Troppa plastica"

Per ogni obiezione fornisci:
- Cosa dice l'utente (obiezione brutale e realistica)
- Script di risposta (empatico, chiaro, rassicurante)
- Angolo psicologico (perché funziona: reframing, risk reversal, social proof)

Rispondi SOLO con JSON:
{{
  "price_objections": [
    {{
      "user_says": "Obiezione utente",
      "response_script": "Risposta completa con emoji e tono brand",
      "psychological_angle": "Perché funziona"
    }}
  ],
  "mechanism_objections": [...],
  "product_objections": [...],
  "ethics_objections": [...]
}}

REGOLE:
✅ Tono empatico, MAI difensivo
✅ Valida il sentimento prima di rispondere
✅ Usa emoji se appropriato al brand
✅ 2-3 obiezioni per categoria"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.2,  # Temperatura più bassa per JSON più pulito
            max_tokens=4000
        )

        import re
        # Estrai solo il JSON, rimuovi eventuali testi prima/dopo
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            # Prova a parsare, se fallisce prova con fallback
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as je:
                print(f"⚠️ JSON parsing fallito per Objections: {je}")
                print(f"Tentativo con pulizia caratteri...")
                # Rimuovi eventuali caratteri problematici
                json_str_clean = json_str.replace('\n', ' ').replace('\r', '')
                try:
                    return json.loads(json_str_clean)
                except:
                    # Fallback: ritorna struttura minima
                    return {
                        "price_objections": [],
                        "mechanism_objections": [],
                        "product_objections": [],
                        "ethics_objections": [],
                        "error": f"JSON parsing fallito: {str(je)}"
                    }
        else:
            return {"raw_text": response, "price_objections": [], "mechanism_objections": [], "product_objections": [], "ethics_objections": []}

    except Exception as e:
        print(f"Errore generazione Objections Management: {e}")
        return {"price_objections": [], "mechanism_objections": [], "product_objections": [], "ethics_objections": [], "error": str(e)}


async def generate_reviews_voc(
    ai_service,
    google_reviews: str = "",
    social_comments: str = ""
) -> Dict[str, Any]:
    """
    SEZIONE 10: VOICE OF CUSTOMER (Review Mining)

    Estrae dalle recensioni reali:
    - Golden Hooks (ganci d'oro da 5 stelle)
    - Pain Points da risolvere (1-3 stelle)
    - Keywords ricorrenti
    """

    system_prompt = f"""Agisci come un Direct Response Copywriter e Customer Insight Analyst.

Analizza recensioni e feedback per estrarre GOLDEN HOOKS e PAIN POINTS.

RECENSIONI GOOGLE:
{google_reviews[:3000] if google_reviews else "Non disponibili"}

COMMENTI SOCIAL:
{social_comments[:3000] if social_comments else "Non disponibili"}

OUTPUT RICHIESTO:

### 1. GOLDEN HOOKS (da recensioni 5 stelle)
Identifica 3-5 concetti chiave ripetuti.
Per ognuno:
- Verbatim (frase esatta del cliente)
- Marketing Hook (trasformata in headline)

Es:
- Verbatim: "Basta una passata e non un graffio"
- Hook: "La prova della passata singola. Taglia tutto al primo colpo."

### 2. PAIN POINTS & CONTRO-ATTACCO (da recensioni 1-3 stelle)
Identifica problemi comuni:
- Pain Point (problema)
- Leva Educativa (come risolverlo)
- Copy Risolutivo (script di risposta)

Es:
- Pain: "Il supporto da muro cade"
- Leva: Educational content su installazione corretta
- Copy: "Il segreto? Pulisci con alcool, premi 30 secondi, aspetta 24h"

### 3. KEYWORDS RICORRENTI
Le 5-7 parole più frequenti (per SEO e copy)

Es: "Delicato", "Manico alluminio", "Passata singola", "Pelle sensibile"

### 4. IDENTIKIT DEL FAN
Chi è il cliente più soddisfatto? Azione post-acquisto da fare?

Rispondi SOLO con JSON:
{{
  "golden_hooks": [
    {{
      "verbatim": "Frase esatta cliente",
      "marketing_hook": "Headline trasformata",
      "usage": "Come usarla in marketing"
    }}
  ],
  "pain_points": [
    {{
      "problem": "Problema comune",
      "educational_lever": "Come educarlo",
      "response_copy": "Script risposta"
    }}
  ],
  "recurring_keywords": ["keyword1", "keyword2"],
  "fan_profile": "Chi è il cliente più felice",
  "post_purchase_action": "Azione consigliata (es. email automatica)"
}}

REGOLE:
✅ Usa SOLO frasi REALI dalle recensioni
✅ NO invenzioni - solo evidenze
✅ Se non ci sono recensioni, ritorna struttura vuota"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.2,
            max_tokens=3000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"golden_hooks": [], "pain_points": [], "recurring_keywords": []}

    except Exception as e:
        print(f"Errore generazione Reviews VoC: {e}")
        return {"golden_hooks": [], "pain_points": [], "recurring_keywords": [], "error": str(e)}


async def generate_battlecards(
    ai_service,
    client_info: Dict[str, Any],
    brand_identity: Dict[str, Any],
    product_portfolio: Dict[str, Any],
    site_url: str
) -> Dict[str, Any]:
    """
    SEZIONE 11: BATTLECARDS COMPETITOR

    Schede competitive per vincere il confronto:
    - vs Competitor Diretto ("Il Gemello")
    - vs Gigante Retail ("Il Comodo")
    - vs Abitudine/Sostituto
    - vs Soluzione Definitiva
    """

    client_name = client_info.get("name", "")
    industry = client_info.get("industry", "")
    metadata = client_info.get("metadata", {})

    # Estrai competitor dai metadata
    competitors = metadata.get("competitors", [])
    competitors_text = ""

    if competitors:
        competitors_text += "\n\n🎯 COMPETITOR REALI (da metadata cliente):\n\n"
        for comp in competitors[:3]:  # Top 3 competitor
            comp_name = comp.get("name", "Sconosciuto")
            comp_links = comp.get("links", [])
            competitors_text += f"\n**{comp_name}:**\n"
            for link in comp_links[:5]:
                url = link.get("url", "")
                label = link.get("label", "Link")
                description = link.get("description", "")
                competitors_text += f"  - {label}: {url}\n"
                if description:
                    competitors_text += f"    Descrizione: {description}\n"
    else:
        competitors_text = "\nNessun competitor specifico fornito nel metadata - genera analisi generica del settore."

    system_prompt = f"""Agisci come Consulente Strategico di Posizionamento.

Analizza {client_name} ({industry}) e crea BATTLECARDS COMPETITIVE.

BRAND:
{json.dumps(brand_identity, ensure_ascii=False)[:1500]}

PRODOTTI/SERVIZI:
{json.dumps(product_portfolio, ensure_ascii=False)[:1500]}

{competitors_text}

Identifica 4 categorie di competitor e crea battlecard per ognuno.
**IMPORTANTE**: Se sono forniti competitor specifici sopra, analizzali PRIORITARIAMENTE e usa i loro link per ricerche approfondite.

### 1. NOI vs IL COMPETITOR DIRETTO ("Il Gemello")
Chi è il brand online più simile a noi?
- Chi sono
- Loro punto di forza
- Loro punto debole
- La nostra mossa vincente
- Script di risposta rapido

### 2. NOI vs IL GIGANTE RETAIL ("Il Comodo")
L'opzione da supermercato/Amazon
- Chi sono
- Perché sembrano convenienti
- Loro punto debole (pink tax, plastica, qualità)
- La nostra mossa
- Script risposta

### 3. NOI vs L'ABITUDINE SEGRETA / SOSTITUTO
Il prodotto usato male (es. rasoio uomo, prodotto generico)
- Cosa usano ora
- Perché non va bene
- Come posizionarci
- Script risposta

### 4. NOI vs LA SOLUZIONE DEFINITIVA ("L'Alternativa")
La soluzione drastica (es. Laser, Chirurgia, etc.)
- Chi sono
- Loro vantaggio
- Loro svantaggio
- Come essere complementari (non nemici)
- Script risposta

### 5. CHEAT SHEET
Tabella frasi secche per chiudere confronti

Rispondi SOLO con JSON:
{{
  "direct_competitor": {{
    "who": "Nome competitor",
    "strength": "Punto forte",
    "weakness": "Punto debole",
    "our_move": "Nostra mossa vincente",
    "quick_script": "Risposta in 1-2 frasi"
  }},
  "retail_giant": {{...}},
  "habit_substitute": {{...}},
  "definitive_solution": {{...}},
  "cheat_sheet": {{
    "Competitor X": "Frase secca risposta",
    "Competitor Y": "Frase secca risposta"
  }}
}}

REGOLE:
✅ Competitor REALI del settore
✅ Mai parlare male - evidenziare differenze
✅ Script empatici e professionali"""

    try:
        response = await ai_service._call_ai(
            model="perplexity/sonar-pro",  # Perplexity per ricerca competitor reali
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
        print(f"Errore generazione Battlecards: {e}")
        return {"error": str(e)}


async def generate_seasonal_roadmap(
    ai_service,
    client_info: Dict[str, Any],
    product_portfolio: Dict[str, Any]
) -> Dict[str, Any]:
    """
    SEZIONE 12: SEASONAL ROADMAP (Piano 12 mesi)

    Roadmap stagionale per massimizzare vendite:
    - Q1: Recovery & Routine
    - Q2: Pre-Summer
    - Q3: Peak Summer
    - Q4: Gifting

    Per ogni mese: Tema, Prodotto Hero, Strategia, Target, Hook & Content
    """

    client_name = client_info.get("name", "")
    industry = client_info.get("industry", "")

    system_prompt = f"""Agisci come Head of Growth.

Crea una ROADMAP STAGIONALE 12 MESI per {client_name} ({industry}).

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False)[:2000]}

Dividi l'anno in 4 fasi e crea strategia per ogni mese chiave:

### Q1 (Gen-Mar): RECOVERY & ROUTINE
Obiettivo: Tenere attivi abbonamenti, sfruttare buoni propositi
- Gennaio: Tema Detox/Reset
- Febbraio: Self-Love / San Valentino alternativo
- Marzo: Preparazione primavera

### Q2 (Apr-Giu): PRE-SUMMER
Obiettivo: Acquisire nuovi clienti prima del picco
- Aprile: Cambio stagione
- Maggio: Preparazione costume
- Giugno: Pride / Inclusività

### Q3 (Lug-Set): PEAK SUMMER
Obiettivo: Massimizzare scontrino medio
- Luglio: Golden hour / Glow
- Agosto: Travel essentials
- Settembre: Back to routine

### Q4 (Ott-Dic): GIFTING
Obiettivo: Fare cassa con BF e regali
- Ottobre: Cozy season
- Novembre: BLACK FRIDAY
- Dicembre: Gift giving

Per ogni mese fornisci:
- Tema creativo
- Prodotto HERO da spingere
- Strategia (promo, bundle, angle)
- Target principale
- Hook + Idea contenuto

Rispondi SOLO con JSON:
{{
  "q1_recovery": [
    {{
      "month": "Gennaio",
      "theme": "Tema del mese",
      "hero_product": "Prodotto da spingere",
      "strategy": "Strategia marketing",
      "target_persona": "A chi parliamo",
      "hook": "Headline",
      "content_idea": "Idea video/post"
    }}
  ],
  "q2_presummer": [...],
  "q3_peak": [...],
  "q4_gifting": [...],
  "tactical_tips": [
    "Tip tattico 1",
    "Tip tattico 2"
  ]
}}"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.4,
            max_tokens=5000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"raw_text": response}

    except Exception as e:
        print(f"Errore generazione Seasonal Roadmap: {e}")
        return {"error": str(e)}


async def generate_psychographic_analysis(
    ai_service,
    client_info: Dict[str, Any],
    customer_personas: List[Dict[str, Any]],
    site_content: str
) -> Dict[str, Any]:
    """
    SEZIONE 13: PSYCHOGRAPHIC ANALYSIS (3 Livelli)

    Analisi psicografica profonda a 3 livelli ESATTAMENTE secondo la guida Francesco Agostinis:
    - Livello PRIMARIO: 8-10 caratteristiche fondamentali
    - Livello SECONDARIO: 10 caratteristiche comportamentali
    - Livello TERZIARIO: 10 micro-caratteristiche

    Ogni caratteristica ha: Livello, Nome, Descrizione, Headline, Sottotitolo
    """

    client_name = client_info.get("name", "")

    system_prompt = f"""Agisci come Psicologo del Consumatore esperto in Analisi Psicografica Avanzata.

Crea una ANALISI PSICOGRAFICA PROFONDA A 3 LIVELLI per il target di {client_name}, seguendo ESATTAMENTE questa struttura.

PERSONAS IDENTIFICATE:
{json.dumps(customer_personas, ensure_ascii=False)[:3000]}

SITO WEB:
{site_content[:2000]}

═══════════════════════════════════════════════════════════════════
LIVELLO PRIMARIO – CARATTERISTICHE FONDAMENTALI (8-10 caratteristiche)
═══════════════════════════════════════════════════════════════════

Elenca 8-10 caratteristiche psicografiche CORE che definiscono il target, analizzando:
- Sistema valoriale (cosa è importante per loro)
- Motivazioni principali (cosa li spinge ad agire)
- Aspirazioni e obiettivi di vita
- Contesto socio-economico
- Tratti caratteriali dominanti
- Bisogni fondamentali
- Sfide principali percepite
- Desideri primari

═══════════════════════════════════════════════════════════════════
LIVELLO SECONDARIO – CARATTERISTICHE COMPORTAMENTALI (10 caratteristiche)
═══════════════════════════════════════════════════════════════════

Fornisci ulteriori 10 caratteristiche PIÙ SPECIFICHE, considerando:
- Stile di vita e abitudini quotidiane
- Comportamenti di consumo
- Interessi e hobby
- Modalità decisionali
- Influenze sociali e relazionali
- Preferenze di comunicazione
- Attitudini verso il cambiamento
- Gestione del tempo
- Approccio alla tecnologia
- Relazione con il denaro

═══════════════════════════════════════════════════════════════════
LIVELLO TERZIARIO – MICRO-CARATTERISTICHE (10 caratteristiche)
═══════════════════════════════════════════════════════════════════

Aggiungi 10 caratteristiche di terzo livello, PIÙ SOTTILI e specifiche:
- Micro-comportamenti distintivi
- Bias cognitivi ricorrenti
- Trigger emotivi
- Paure nascoste
- Desideri inespressi
- Pattern comunicativi specifici
- Rituali personali
- Credenze limitanti
- Aspettative implicite
- Predisposizioni latenti

═══════════════════════════════════════════════════════════════════
APPLICAZIONE MARKETING
═══════════════════════════════════════════════════════════════════

Per OGNI caratteristica identificata, sviluppa:
1. **Headline Promozionale**: massimo 10 parole che fanno leva su quella caratteristica psicografica
2. **Sottotitolo**: frase di supporto che amplifica il messaggio

═══════════════════════════════════════════════════════════════════
OUTPUT RICHIESTO (JSON)
═══════════════════════════════════════════════════════════════════

Rispondi SOLO con questo formato JSON:
{{
  "level_1_primary": [
    {{
      "characteristic": "Nome breve della caratteristica",
      "description": "Descrizione dettagliata (2-3 frasi concrete, specifiche per questo target)",
      "headline": "Headline promozionale massimo 10 parole",
      "subtitle": "Sottotitolo di supporto"
    }},
    ...  (ripeti per 8-10 caratteristiche)
  ],
  "level_2_secondary": [
    {{
      "characteristic": "Nome breve della caratteristica",
      "description": "Descrizione dettagliata (2-3 frasi concrete, specifiche per questo target)",
      "headline": "Headline promozionale massimo 10 parole",
      "subtitle": "Sottotitolo di supporto"
    }},
    ...  (ripeti per 10 caratteristiche)
  ],
  "level_3_tertiary": [
    {{
      "characteristic": "Nome breve della caratteristica",
      "description": "Descrizione dettagliata (2-3 frasi concrete, specifiche per questo target)",
      "headline": "Headline promozionale massimo 10 parole",
      "subtitle": "Sottotitolo di supporto"
    }},
    ...  (ripeti per 10 caratteristiche)
  ]
}}

REGOLE FONDAMENTALI:
✅ Mantieni approccio OGGETTIVO e professionale
✅ Evita stereotipi e generalizzazioni inappropriate
✅ Ogni caratteristica deve essere MISURABILE o OSSERVABILE
✅ Rilevante per il target specifico
✅ Utile per strategie di marketing concrete
✅ Culturalmente appropriata
✅ Bilancia aspetti razionali ed emotivi
✅ Considera evoluzione temporale del target
✅ Le headline devono essere INCISIVE e RISONANTI con la caratteristica
✅ Ogni livello deve aggiungere PROFONDITÀ all'analisi, non reiterare concetti"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.3,
            max_tokens=8000  # Aumentato per 3 livelli completi
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            # Verifica che abbia tutti e 3 i livelli
            if "level_1_primary" in data and "level_2_secondary" in data and "level_3_tertiary" in data:
                return data
            else:
                print(f"⚠️ Analisi psicografica incompleta - mancano livelli")
                return {
                    "level_1_primary": data.get("level_1_primary", []),
                    "level_2_secondary": data.get("level_2_secondary", []),
                    "level_3_tertiary": data.get("level_3_tertiary", []),
                    "error": "Alcuni livelli mancanti"
                }
        else:
            return {"level_1_primary": [], "level_2_secondary": [], "level_3_tertiary": [], "raw_text": response}

    except Exception as e:
        print(f"Errore generazione Psychographic Analysis: {e}")
        return {"level_1_primary": [], "level_2_secondary": [], "level_3_tertiary": [], "error": str(e)}


async def generate_visual_brief(
    ai_service,
    brand_identity: Dict[str, Any],
    brand_voice: Dict[str, Any],
    customer_personas: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    SEZIONE 14: VISUAL BRIEF

    Brief visivo completo per designer e videomaker:
    - Palette colori
    - Typography guidelines
    - Mood & Style riferimenti
    - Format guidelines (Stories, Feed, Banner)
    - Do/Don't visivi
    """

    system_prompt = f"""Agisci come Creative Director.

Crea un VISUAL BRIEF completo per designer e videomaker.

BRAND IDENTITY:
{json.dumps(brand_identity, ensure_ascii=False)[:1500]}

BRAND VOICE:
{json.dumps(brand_voice, ensure_ascii=False)[:1500]}

PERSONAS:
{json.dumps(customer_personas, ensure_ascii=False)[:1500]}

OUTPUT RICHIESTO:

### 1. COLOR PALETTE
- Colori primari (HEX)
- Colori secondari
- Quando usare ogni colore

### 2. TYPOGRAPHY
- Font principali (se identificabili)
- Stile tipografico (moderno, classico, bold, minimale)
- Gerarchia testo

### 3. MOOD & STYLE
- Mood generale (es. clinico ma accogliente, lusso accessibile)
- Riferimenti visivi (es. minimalismo nordico, estetica Instagram)
- Cosa evitare

### 4. PHOTOGRAPHY STYLE
- Tipo di foto (stock professional, UGC, lifestyle, product only)
- Composizione (flat lay, in context, close-up)
- Lighting (naturale, studio, dramatic)

### 5. VIDEO GUIDELINES
- Durata ideale per formato
- Stile (ASMR, educational, testimonial, POV)
- Musica/Audio

### 6. FORMAT SPECS
- Stories 9:16
- Feed 4:5
- Banner 16:9
- Pinterest 2:3

### 7. DO/DON'T VISIVI
Esempi di cosa fare e NON fare

Rispondi SOLO con JSON:
{{
  "color_palette": {{
    "primary": ["#HEX1", "#HEX2"],
    "secondary": ["#HEX3"],
    "usage": "Quando usare ogni colore"
  }},
  "typography": {{
    "primary_font": "Nome font",
    "style": "Descrizione stile",
    "hierarchy": "Gerarchia testo"
  }},
  "mood_style": {{
    "overall_mood": "Mood generale",
    "references": ["Riferimento 1", "Riferimento 2"],
    "avoid": ["Cosa evitare 1"]
  }},
  "photography": {{
    "style": "Tipo foto",
    "composition": "Composizione",
    "lighting": "Lighting"
  }},
  "video": {{
    "duration": "Durata ideale",
    "style": ["Stile 1", "Stile 2"],
    "audio": "Musica/Audio"
  }},
  "format_specs": {{
    "stories": "9:16 - Specifiche",
    "feed": "4:5 - Specifiche",
    "banner": "16:9 - Specifiche"
  }},
  "do_dont": [
    {{
      "do": "Cosa fare",
      "dont": "Cosa NON fare"
    }}
  ]
}}"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.2,  # Temperatura più bassa per JSON più pulito
            max_tokens=3000
        )

        import re
        # Estrai solo il JSON, rimuovi eventuali testi prima/dopo
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            # Prova a parsare, se fallisce prova con fallback
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as je:
                print(f"⚠️ JSON parsing fallito per Visual Brief: {je}")
                print(f"Tentativo con pulizia caratteri...")
                # Rimuovi eventuali caratteri problematici
                json_str_clean = json_str.replace('\n', ' ').replace('\r', '')
                try:
                    return json.loads(json_str_clean)
                except:
                    # Fallback: ritorna struttura minima
                    return {
                        "color_palette": {"primary": [], "secondary": [], "usage": ""},
                        "typography": {"primary_font": "", "style": "", "hierarchy": ""},
                        "mood_style": {"overall_mood": "", "references": [], "avoid": []},
                        "photography": {"style": "", "composition": "", "lighting": ""},
                        "video": {"duration": "", "style": [], "audio": ""},
                        "format_specs": {"stories": "", "feed": "", "banner": ""},
                        "do_dont": [],
                        "error": f"JSON parsing fallito: {str(je)}"
                    }
        else:
            return {"raw_text": response, "error": "Nessun JSON trovato nella risposta"}

    except Exception as e:
        print(f"Errore generazione Visual Brief: {e}")
        return {"error": str(e)}
