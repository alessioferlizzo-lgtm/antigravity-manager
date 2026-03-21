"""
AIService - Complete Analysis Functions
Implementazione delle 12 sezioni dell'analisi completa secondo la metodologia della guida.
Usa i prompt ESATTI dalla guida "guida su come fare analisi.md"
"""

import json
import json_repair
import re
from typing import Dict, Any, List


class CompleteAnalysisService:
    """
    Service per generare l'analisi completa del cliente.
    Ogni funzione corrisponde a una sezione specifica della guida.
    """

    def __init__(self, ai_service):
        """
        Args:
            ai_service: istanza di AIService per chiamare i modelli AI
        """
        self.ai = ai_service

    async def generate_brand_identity(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        social_data: str = "",
        raw_docs: str = "",
        ads_data: str = ""
    ) -> Dict[str, Any]:
        """
        1. BRAND IDENTITY & POSIZIONAMENTO
        Prompt dalla guida: "Generatore di Knowledge Base Strategica (Brand Analysis)"
        """

        client_name = client_info.get('name', '')
        links = [site_url] if site_url else []

        # Aggiungi link social se presenti
        if isinstance(client_info.get('links'), list):
            for link in client_info['links']:
                url = link.get('url', '') if isinstance(link, dict) else str(link)
                if url:
                    links.append(url)

        links_str = "\n".join([f"- {l}" for l in links]) if links else "Nessun link fornito."

        social_context = f"""
📊 DATI SOCIAL REALI (fonte primaria — estratti da Instagram API):
{social_data}

ISTRUZIONI: Analizza il tono di voce dai post, l'estetica dalle immagini, il posizionamento dai commenti del pubblico.
""" if social_data else ""

        docs_context = f"\n📁 DOCUMENTI CARICATI:\n{raw_docs}\n" if raw_docs else ""

        ads_context = f"""
📢 ADS ATTIVE SU META (fonte primaria — estratte da Meta Ads Manager):
{ads_data}

ISTRUZIONI: Analizza il tono di voce degli ads, il posizionamento comunicato, i valori trasmessi.
""" if ads_data else ""

        prompt = f"""Ruolo: Agisci come un Senior Brand Strategist & Marketing Analyst con esperienza in e-commerce D2C (Direct-to-Consumer). Il tuo compito è analizzare a fondo il sito web fornito e creare una "Knowledge Base Strategica" completa e strutturata.

Input: Link al sito web: {site_url}

CLIENTE: {client_name}

LINK E ASSET DA ANALIZZARE:
{links_str}

{social_context}
{ads_context}
{docs_context}

Istruzioni di Analisi: Naviga il sito web fornito, leggendo le pagine "Chi Siamo/About", le pagine prodotto (PDP), le FAQ, il Blog e le pagine relative alla sostenibilità o mission. Amplia l'analisi usando i dati social, ads e documenti forniti.

Output Richiesto: Genera un report dettagliato in italiano, strutturato esattamente in questi punti. Usa formattazione Markdown, elenchi puntati, grassetti per rendere il testo altamente leggibile.

STRUTTURA OBBLIGATORIA:

## MISSION
Qual è lo scopo profondo del brand? Come ridefinisce la sua categoria? (Es. non solo "vendere rasoi" ma "cambiare la narrazione sulla depilazione").

## TONO DI VOCE
Analizza il linguaggio. È formale, amichevole, inclusivo (es. uso dello schwa), ironico? A chi parla (Gen Z, Millennial)? Usa citazioni ESATTE dai testi analizzati.

## ESTETICA (Visual Identity)
Descrivi i colori dominanti, il design del packaging (se visibile), lo stile visivo (es. minimalista, instagrammabile, lussuoso, giovanile).

## POSIZIONAMENTO
Definisci la fascia di mercato (es. "Masstige", Lusso Accessibile, Premium, Economico, Mainstream).

## STATEMENT
Una frase sintetica (max 2 righe) che riassume come il brand trasforma la routine/vita del cliente.

IMPORTANTE:
- Usa CITAZIONI LETTERALI dai testi del sito, social, ads
- Zero genericità: ogni affermazione deve essere supportata da esempi concreti
- Se non trovi informazioni sufficienti per una sezione, scrivi "Informazioni insufficienti per analizzare [sezione]"

Rispondi ESCLUSIVAMENTE con un JSON valido in questo formato:
{{
  "mission": "...",
  "tono_di_voce": "...",
  "estetica": "...",
  "posizionamento": "...",
  "statement": "..."
}}
"""

        messages = [{"role": "user", "content": prompt}]
        # Usa Perplexity per ricerca web profonda
        result_str = await self.ai._call_ai("perplexity/sonar-pro", messages, temperature=0.6)
        return json_repair.loads(result_str)

    async def generate_brand_values(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        social_data: str = "",
        raw_docs: str = ""
    ) -> Dict[str, Any]:
        """
        2. VALORI DEL BRAND (Brand Pillars)
        Identifica i pilastri etici e morali del brand
        """

        client_name = client_info.get('name', '')

        social_context = f"\n📊 DATI SOCIAL:\n{social_data}\n" if social_data else ""
        docs_context = f"\n📁 DOCUMENTI:\n{raw_docs}\n" if raw_docs else ""

        prompt = f"""Ruolo: Agisci come un Brand Analyst specializzato in valori etici e posizionamento valoriale.

CLIENTE: {client_name}
SITO: {site_url}

{social_context}
{docs_context}

Istruzioni: Identifica i pilastri etici e morali su cui si fonda il brand. Cerca riferimenti espliciti e impliciti nelle pagine "Chi Siamo", "Sostenibilità", "Valori", nei post social, nelle descrizioni prodotto.

Analizza questi 4 pilastri principali:

1. INCLUSIVITÀ
Cerca riferimenti a: gender neutrality, LGBTQIA+, body positivity, diversity, accessibilità.

2. SOSTENIBILITÀ (Eco-Conscious)
Cerca: certificazioni (Carbon Neutral, B-Corp), materiali usati (riciclati, biodegradabili), partnership ecologiche, packaging sostenibile.

3. FORMULAZIONI
Verifica se i prodotti sono: Vegan, Cruelty-free, Clean Beauty, senza parabeni/solfati/siliconi, biologici, dermatologicamente testati.

4. QUALITÀ PREMIUM
Materiali e ingredienti distintivi, artigianalità, made in Italy/local, lavorazioni speciali.

IMPORTANTE:
- Cita ESATTAMENTE le frasi dal sito o dai materiali che dimostrano ogni valore
- Se un valore NON è presente o verificabile, scrivi chiaramente "Non rilevato" per quel pilastro
- Distingui tra claim espliciti ("Siamo 100% vegan") e valori impliciti (uso di termini come "naturale", "gentile sulla pelle")

Rispondi SOLO con JSON:
{{
  "inclusivita": {{
    "presente": true/false,
    "evidenze": ["citazione 1", "citazione 2", ...],
    "descrizione": "..."
  }},
  "sostenibilita": {{
    "presente": true/false,
    "evidenze": ["...", "..."],
    "certificazioni": ["...", "..."],
    "descrizione": "..."
  }},
  "formulazioni": {{
    "vegan": true/false,
    "cruelty_free": true/false,
    "clean_beauty": true/false,
    "evidenze": ["...", "..."],
    "descrizione": "..."
  }},
  "qualita_premium": {{
    "presente": true/false,
    "evidenze": ["...", "..."],
    "descrizione": "..."
  }}
}}
"""

        messages = [{"role": "user", "content": prompt}]
        result_str = await self.ai._call_ai("perplexity/sonar-pro", messages, temperature=0.5)
        return json_repair.loads(result_str)

    async def generate_product_portfolio(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        raw_docs: str = ""
    ) -> Dict[str, Any]:
        """
        3. ANALISI PORTAFOGLIO PRODOTTI
        Non fare un semplice elenco. Dividi i prodotti per fase di utilizzo o categoria
        """

        client_name = client_info.get('name', '')
        docs_context = f"\n📁 DOCUMENTI (cataloghi, menu, listini):\n{raw_docs}\n" if raw_docs else ""

        prompt = f"""Ruolo: Agisci come un Product Marketing Manager esperto.

CLIENTE: {client_name}
SITO: {site_url}

{docs_context}

Istruzioni di Analisi: Analizza il portafoglio prodotti del brand. Naviga le pagine Shop/Prodotti/Menu/Servizi. Se forniti, usa i documenti caricati (cataloghi PDF, menu, listini) come fonte primaria.

Non fare un semplice elenco. Dividi i prodotti per fase di utilizzo o categoria logica (es: Core Products, Pre-utilizzo, Post-utilizzo, Lifestyle, Seasonal, ecc.)

Per ogni prodotto chiave analizza:
- Nome Prodotto & Categoria
- Benefit/Tecnologia: Cosa fa? Come funziona? (es. tecnologie brevettate, meccanismi innovativi)
- Ingredienti Chiave: Quali attivi specifici usa? (per cosmetici/food/bevande)
- USP (Unique Selling Proposition): Perché è unico sul mercato? (es. oggetto di design, rallenta la ricrescita, unico nel settore)

FOCUS:
- Per e-commerce: analizza almeno i top 5-10 prodotti più importanti
- Per ristoranti/bar: analizza le categorie del menu (antipasti, primi, dolci, drink signature)
- Per servizi: analizza i pacchetti/trattamenti principali

IMPORTANTE:
- Usa i NOMI ESATTI dei prodotti come appaiono sul sito/menu
- Se disponibili, includi i PREZZI
- Cita ingredienti/caratteristiche SPECIFICHE, non generiche

Rispondi SOLO con JSON:
{{
  "categorie": [
    {{
      "nome_categoria": "Core Products / Menu Principale / ecc",
      "descrizione": "Breve descrizione della categoria",
      "prodotti": [
        {{
          "nome": "Nome esatto prodotto",
          "categoria": "Tipologia",
          "prezzo": "€XX o range",
          "benefit_tecnologia": "Cosa fa e come",
          "ingredienti_chiave": ["Ingrediente 1", "Ingrediente 2", "..."],
          "usp": "Cosa lo rende unico"
        }}
      ]
    }}
  ]
}}
"""

        messages = [{"role": "user", "content": prompt}]
        result_str = await self.ai._call_ai("perplexity/sonar-pro", messages, temperature=0.5, max_tokens=20000)
        return json_repair.loads(result_str)

    async def generate_reasons_to_buy(
        self,
        client_info: Dict[str, Any],
        brand_identity: Dict[str, Any],
        product_portfolio: Dict[str, Any],
        brand_values: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        4. REASONS TO BUY (RTB)
        Distingui le motivazioni di acquisto in due categorie: Razionali vs Emotive
        """

        client_name = client_info.get('name', '')

        # Crea contesto dalle sezioni precedenti
        context = f"""
BRAND: {client_name}

IDENTITY & POSIZIONAMENTO:
{json.dumps(brand_identity, ensure_ascii=False, indent=2)}

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False, indent=2)}

VALORI:
{json.dumps(brand_values, ensure_ascii=False, indent=2)}
"""

        prompt = f"""Ruolo: Agisci come un Consumer Psychologist & Sales Strategist.

{context}

Istruzioni: Basandoti sull'analisi del brand, identifica le motivazioni di acquisto (Reasons to Buy) distinguendole in DUE categorie ben separate:

RTB RAZIONALI (Logica - la testa)
Motivazioni basate su efficacia, convenienza, praticità:
- Efficacia tecnica (es. "5 lame svedesi = meno passate")
- Convenienza economica (es. "abbonamento = risparmio nel tempo")
- Risparmio di tempo (es. "consegna automatica")
- Soluzioni a problemi pratici (es. "supporto magnetico risolve il disordine")

RTB EMOTIVE (Cuore - la pancia)
Motivazioni basate su valori, identità, sensazioni:
- Valori etici (es. "sostieni LGBTQIA+", "zero plastica")
- "Joy of use" / Esperienza sensoriale (es. "profumo che sa di vacanza")
- Estetica e design (es. "oggetto Instagram-worthy")
- Self-care e coccole (es. "trasforma la routine in rituale")
- Appartenenza a una community (es. "entra nel club")
- Status e identità (es. "per chi sa riconoscere la qualità")

IMPORTANTE:
- Minimo 4-5 RTB per categoria
- Ogni RTB deve essere SPECIFICA per questo brand, non generica
- Usa citazioni o riferimenti dai dati analizzati

Rispondi SOLO con JSON:
{{
  "rtb_razionali": [
    {{
      "titolo": "Es: Efficacia Superiore",
      "descrizione": "Descrizione specifica con dettagli tecnici"
    }}
  ],
  "rtb_emotive": [
    {{
      "titolo": "Es: Rituale di Bellezza",
      "descrizione": "Descrizione emotiva e aspirazionale"
    }}
  ]
}}
"""

        messages = [{"role": "user", "content": prompt}]
        result_str = await self.ai._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.6)
        return json_repair.loads(result_str)

    async def generate_customer_personas(
        self,
        client_info: Dict[str, Any],
        brand_identity: Dict[str, Any],
        product_portfolio: Dict[str, Any],
        social_data: str = "",
        ads_data: str = ""
    ) -> List[Dict[str, Any]]:
        """
        5. LE 10 IDEAL CUSTOMER PERSONAS (ICP)
        Estrapola 10 profili di clienti ideali molto specifici
        """

        client_name = client_info.get('name', '')

        context = f"""
BRAND: {client_name}

IDENTITY:
{json.dumps(brand_identity, ensure_ascii=False, indent=2)}

PRODOTTI:
{json.dumps(product_portfolio, ensure_ascii=False, indent=2)}
"""

        social_context = f"\n📊 COMMENTI E INTERAZIONI SOCIAL (usa per capire chi è il pubblico reale):\n{social_data}\n" if social_data else ""
        ads_context = f"\n📢 DATI ADS (usa per capire a chi si rivolge la comunicazione):\n{ads_data}\n" if ads_data else ""

        prompt = f"""{context}

{social_context}
{ads_context}

Ruolo: Agisci come un Consumer Insights Analyst.

Istruzioni: Estrapola esattamente 10 profili di clienti ideali (ICP) molto specifici basandoti sui prodotti, sul tono del brand, sui commenti social e sugli ads.

Dai a ognuno un NOME EVOCATIVO che cattura l'essenza del personaggio (es. "Skincare Intellectual", "Aesthetic Curator", "Eco-Conscious Chic", "Busy Professional", "Hater della Depilazione").

Per ogni Persona definisci:
- Nome evocativo (max 3 parole)
- Chi è: Descrizione psicografica (età, lifestyle, valori, abitudini digitali)
- Problema principale: Qual è la sua frustrazione / cosa cerca / cosa odia

IMPORTANTE:
- Le personas devono essere MOLTO SPECIFICHE e realistiche, non stereotipi generici
- Usa il linguaggio che queste persone userebbero ("non riesco a dimagrire" non "difficoltà nel perdere peso")
- Se hai dati dai commenti social, usa LE LORO PAROLE per descrivere i problemi

Rispondi SOLO con JSON array:
[
  {{
    "nome": "Es: La Skincare Intellectual",
    "chi_e": "Descrizione dettagliata della persona",
    "problema_principale": "Cosa cerca o qual è il suo problema"
  }}
]
"""

        messages = [{"role": "user", "content": prompt}]
        result_str = await self.ai._call_ai("anthropic/claude-3.7-sonnet", messages, temperature=0.7, max_tokens=16000)

        # Parse JSON array
        start = result_str.find("[")
        end = result_str.rfind("]") + 1
        if start != -1 and end > start:
            json_str = result_str[start:end]
            return json_repair.loads(json_str)
        return []


ai_service = None
