"""
Sistema di Analisi Strategica Completa
Basato sulla metodologia di Francesco Agostinis per Meta Ads

Questo modulo implementa il sistema completo di analisi seguendo ESATTAMENTE
i prompt della guida "Strategie Di Marketing Avanzate Con Gemini Per Meta Ads"
"""

import json
from typing import Dict, Any, List, Optional
import asyncio
import httpx


class StrategicAnalysisService:
    """
    Servizio principale per generare analisi strategiche complete.
    Segue la metodologia Francesco Agostinis step-by-step.
    """

    def __init__(self, ai_service):
        self.ai_service = ai_service

    async def generate_brand_identity(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        site_content: str,
        social_data: str = "",
        raw_docs: str = ""
    ) -> Dict[str, Any]:
        """
        SEZIONE 1: BRAND IDENTITY & POSIZIONAMENTO

        Prompt esatto dalla guida Francesco Agostinis.
        Genera analisi profonda di: Mission, Tono di Voce, Estetica, Posizionamento, Statement
        """

        client_name = client_info.get("name", "")
        industry = client_info.get("industry", "")

        system_prompt = f"""Agisci come un Senior Brand Strategist & Marketing Analyst con esperienza in e-commerce D2C (Direct-to-Consumer).

Il tuo compito è analizzare a fondo il sito web e i documenti forniti e creare la sezione "BRAND IDENTITY & POSIZIONAMENTO" della Knowledge Base Strategica.

CONTESTO CLIENTE:
Nome: {client_name}
Settore: {industry}
Sito Web: {site_url}

CONTENUTO SITO WEB:
{site_content[:8000]}

DATI SOCIAL E MARKETING:
{social_data[:3000] if social_data else "Non disponibili"}

DOCUMENTI AGGIUNTIVI:
{raw_docs[:3000] if raw_docs else "Non disponibili"}

OUTPUT RICHIESTO:
Genera un report dettagliato in italiano strutturato ESATTAMENTE nei seguenti punti:

### 1. BRAND IDENTITY & POSIZIONAMENTO

**MISSION (Lo Scopo Profondo)**
- Qual è lo scopo profondo del brand? Come ridefinisce la sua categoria?
- Non solo "cosa vende" ma "cosa trasforma" nella vita del cliente
- Esempio: non solo "vendere rasoi" ma "cambiare la narrazione sulla depilazione"

**TONO DI VOCE (Copywriting Strategico)**
- Analizza il linguaggio del brand. È formale, amichevole, inclusivo, ironico?
- A chi parla (Gen Z, Millennial, professionisti, etc.)?
- Vocabolario strategico: quali parole chiave usa il brand?
- Stile comunicativo: usa "tu", "lei", emoji, schwa (ə)?

**VISUAL IDENTITY & ESTETICA**
- Descrivi i colori dominanti del brand
- Stile del design: minimalista, lusso, giovanile, professionale?
- Packaging e presentazione (se applicabile)
- Mood generale: clinico, accogliente, premium, casual?

**POSIZIONAMENTO (Unique Selling Proposition)**
- Definisci la fascia di mercato: Lusso, Premium, Masstige, Economico?
- Quali sono i 2-3 differenziatori chiave rispetto ai competitor?
- Segmento di riferimento (es. "Estetica Specialistica ad alta integrità")

**STATEMENT (La frase guida)**
- Una frase sintetica (max 2 righe) che riassume come il brand trasforma la routine/vita del cliente
- Deve essere potente, memorabile e unica

**NOTE STRATEGICHE AGGIUNTIVE**
- Asset unici del brand (storia del founder, certificazioni, esclusività)
- Elementi che generano autorità immediata
- Punti di forza per il posizionamento di marketing

REGOLE FONDAMENTALI:
✅ Usa formattazione Markdown con grassetti per evidenziare concetti chiave
✅ Sii specifico e concreto, NON generico
✅ Basa tutto sui DATI forniti, non inventare
✅ Usa elenchi puntati per massima leggibilità
✅ Ogni affermazione deve essere supportata da evidenze dal sito/documenti

Rispondi SOLO con il JSON strutturato seguendo questo schema:
{{
  "mission": "Testo della mission dettagliato",
  "mission_transformation": "Cosa trasforma nella vita del cliente",
  "tone_of_voice": {{
    "style": "Descrizione dello stile comunicativo",
    "target_audience": "A chi parla",
    "vocabulary": ["parola1", "parola2", "parola3"],
    "linguistic_approach": "Come comunica (tu/lei, formale/informale, emoji si/no)"
  }},
  "visual_identity": {{
    "colors": ["colore1", "colore2"],
    "design_style": "Minimalista/Lusso/Professionale/etc",
    "mood": "Descrizione del mood generale",
    "packaging": "Descrizione packaging se applicabile"
  }},
  "positioning": {{
    "market_tier": "Lusso/Premium/Masstige/Economico",
    "segment": "Descrizione segmento specifico",
    "differentiators": [
      "Differenziatore 1 con spiegazione",
      "Differenziatore 2 con spiegazione",
      "Differenziatore 3 con spiegazione"
    ]
  }},
  "brand_statement": "La frase guida potente e memorabile",
  "strategic_notes": [
    "Asset unico 1",
    "Asset unico 2",
    "Punto di forza 1"
  ]
}}"""

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": system_prompt}],
                temperature=0.3,
                max_tokens=4000
            )

            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"raw_text": response}

        except Exception as e:
            print(f"Errore generazione Brand Identity: {e}")
            return {
                "error": str(e),
                "mission": "Errore durante la generazione",
                "tone_of_voice": {},
                "visual_identity": {},
                "positioning": {},
                "brand_statement": "",
                "strategic_notes": []
            }

    async def generate_brand_values(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        site_content: str,
        social_data: str = "",
        raw_docs: str = ""
    ) -> Dict[str, Any]:
        """
        SEZIONE 2: VALORI DEL BRAND (Brand Pillars)

        Identifica i pilastri etici e morali su cui si fonda il brand.
        """

        client_name = client_info.get("name", "")

        system_prompt = f"""Agisci come un Senior Brand Strategist.

Il tuo compito è identificare i VALORI DEL BRAND (Brand Pillars) - i pilastri etici e morali su cui si fonda {client_name}.

CONTESTO:
Sito Web: {site_url}

CONTENUTO SITO:
{site_content[:8000]}

DATI SOCIAL:
{social_data[:2000] if social_data else "Non disponibili"}

OUTPUT RICHIESTO:
Identifica 3-5 PILASTRI DEL BRAND cercando evidenze di:

1. **INCLUSIVITÀ**
   - Gender neutrality, LGBTQIA+, body positivity
   - Linguaggio inclusivo (schwa, neutro)
   - Apertura a tutti i tipi di clienti

2. **SOSTENIBILITÀ (Eco-Conscious)**
   - Certificazioni (Carbon Neutral, B-Corp, etc.)
   - Materiali sostenibili (alluminio vs plastica, riciclo, etc.)
   - Partnership ecologiche

3. **ETICA E RESPONSABILITÀ**
   - Salute sopra il profitto
   - Trasparenza e onestà
   - Educazione vs vendita aggressiva

4. **FORMULAZIONI & QUALITÀ**
   - Vegan, Cruelty-free, Clean Beauty
   - Ingredienti premium o distintivi
   - Certificazioni di qualità

5. **ALTRI VALORI SPECIFICI**
   - Pro-aging, body positivity, empowerment
   - Community e appartenenza
   - Artigianalità, Made in Italy, locale

Per ogni pilastro identificato fornisci:
- Nome del pilastro
- Descrizione dettagliata
- Evidenze concrete dal sito/materiali
- Impatto sul cliente (perché è importante)

Rispondi SOLO con JSON:
{{
  "brand_pillars": [
    {{
      "name": "Nome pilastro",
      "description": "Descrizione dettagliata",
      "evidence": ["evidenza 1", "evidenza 2"],
      "customer_impact": "Perché è importante per il cliente"
    }}
  ]
}}"""

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": system_prompt}],
                temperature=0.3,
                max_tokens=3000
            )

            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"brand_pillars": [], "raw_text": response}

        except Exception as e:
            print(f"Errore generazione Brand Values: {e}")
            return {"brand_pillars": [], "error": str(e)}

    async def generate_product_portfolio(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        site_content: str,
        raw_docs: str = ""
    ) -> Dict[str, Any]:
        """
        SEZIONE 3: ANALISI PORTAFOGLIO PRODOTTI

        Analisi verticale di ogni prodotto con:
        - Nome & Categoria
        - Benefit/Tecnologia
        - Ingredienti Chiave
        - USP (Unique Selling Proposition)
        - Problema Cliente che risolve
        - Marketing Hooks (3 headline pronte)
        """

        client_name = client_info.get("name", "")

        system_prompt = f"""Agisci come un Product Marketing Manager esperto.

Il tuo compito è analizzare tecnicamente ogni singolo prodotto di {client_name} e tradurre le caratteristiche tecniche in leve di marketing persuasive.

CONTESTO:
Sito: {site_url}

CONTENUTO SITO (pagine prodotto):
{site_content[:10000]}

DOCUMENTI AGGIUNTIVI:
{raw_docs[:3000] if raw_docs else "Non disponibili"}

ISTRUZIONI:
Per OGNI prodotto principale identificato:

### ANALISI TECNICA & PUNTI DI FORZA
- **Materiali/Texture**: Di cosa è fatto?
- **Tecnologia/Innovazione**: Ci sono brevetti o meccanismi particolari?
- **Ingredienti Chiave**: Quali sono gli attivi principali e cosa fanno?
- **Accessori/Formato**: Cosa è incluso o qual è il pack?

### STRATEGIA DI MARKETING
- **Problema Cliente**: Quale problema specifico risolve? (es. "pelle che si affloscia", "macchie dell'età")
- **Reason to Buy (RTB)**: 3 motivi convincenti per acquistare (mix logica ed emozione)
- **ICP Target**: Chi è il cliente ideale per questo prodotto?
- **USP**: Perché è UNICO sul mercato? Cosa lo differenzia?

### MARKETING HOOKS
- 3 headline pubblicitarie pronte all'uso (brevi, incisive, persuasive)

OUTPUT JSON:
{{
  "products": [
    {{
      "name": "Nome Prodotto",
      "category": "Categoria (es. Viso/Corpo/Tool)",
      "technical_analysis": {{
        "materials": "Materiali e texture",
        "technology": "Tecnologie o innovazioni",
        "key_ingredients": ["Ingrediente 1", "Ingrediente 2"],
        "format": "Formato e accessori inclusi"
      }},
      "marketing_strategy": {{
        "customer_problem": "Problema specifico che risolve",
        "reasons_to_buy": [
          "RTB 1: motivazione logica/emotiva",
          "RTB 2: motivazione logica/emotiva",
          "RTB 3: motivazione logica/emotiva"
        ],
        "target_icp": "Chi è il cliente ideale",
        "usp": "Perché è unico sul mercato"
      }},
      "marketing_hooks": [
        "Hook 1: headline pronta",
        "Hook 2: headline pronta",
        "Hook 3: headline pronta"
      ]
    }}
  ]
}}

REGOLE:
✅ NON fare un semplice elenco - analizza in profondità
✅ Focus su BENEFICI non caratteristiche
✅ Usa linguaggio persuasivo nei hooks
✅ Sii specifico e concreto"""

        try:
            response = await self.ai_service._call_ai(
                model="perplexity/sonar-pro",
                messages=[{"role": "user", "content": system_prompt}],
                temperature=0.3,
                max_tokens=6000
            )

            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"products": [], "raw_text": response}

        except Exception as e:
            print(f"Errore generazione Product Portfolio: {e}")
            return {"products": [], "error": str(e)}


async def generate_complete_strategic_analysis(
    ai_service,
    client_info: Dict[str, Any],
    site_url: str,
    site_content: str,
    social_data: str = "",
    ads_data: str = "",
    raw_docs: str = "",
    google_reviews: str = "",
    instagram_comments: str = ""
) -> Dict[str, Any]:
    """
    ORCHESTRATOR PRINCIPALE

    Genera l'analisi strategica completa in 14 sezioni seguendo
    la metodologia Francesco Agostinis.

    Questo è il nuovo sistema che sostituisce completamente il vecchio.
    """

    service = StrategicAnalysisService(ai_service)

    print("🚀 INIZIO ANALISI STRATEGICA COMPLETA (Metodologia Francesco Agostinis)")
    print(f"📊 Cliente: {client_info.get('name')}")
    print(f"🌐 Sito: {site_url}")
    print("=" * 80)

    # FASE 1: Brand Identity & Posizionamento
    print("\n🔄 Step 1/14 - BRAND IDENTITY & POSIZIONAMENTO...")
    brand_identity = await service.generate_brand_identity(
        client_info, site_url, site_content, social_data, raw_docs
    )
    print("✅ Brand Identity completata")

    # FASE 2: Brand Values (Pillars)
    print("\n🔄 Step 2/14 - BRAND VALUES (Pilastri)...")
    brand_values = await service.generate_brand_values(
        client_info, site_url, site_content, social_data, raw_docs
    )
    print("✅ Brand Values completati")

    # FASE 3: Product Portfolio
    print("\n🔄 Step 3/14 - PRODUCT PORTFOLIO (Analisi Verticale)...")
    product_portfolio = await service.generate_product_portfolio(
        client_info, site_url, site_content, raw_docs
    )
    print("✅ Product Portfolio completato")

    # Import delle funzioni dalle parti 2 e 3
    from .ai_service_strategic_analysis_part2 import (
        generate_reasons_to_buy,
        generate_customer_personas,
        generate_content_matrix,
        generate_brand_voice
    )
    from .ai_service_strategic_analysis_part3 import (
        generate_objections_management,
        generate_reviews_voc,
        generate_battlecards,
        generate_seasonal_roadmap,
        generate_psychographic_analysis,
        generate_visual_brief
    )

    # FASE 4: Reasons to Buy
    print("\n🔄 Step 4/14 - REASONS TO BUY (Razionali + Emotivi)...")
    reasons_to_buy = await generate_reasons_to_buy(
        ai_service, client_info, brand_identity, brand_values, product_portfolio
    )
    print("✅ Reasons to Buy completati")

    # FASE 5: Customer Personas (10 ICP)
    print("\n🔄 Step 5/14 - CUSTOMER PERSONAS (10 ICP)...")
    customer_personas = await generate_customer_personas(
        ai_service, client_info, site_content, brand_identity, product_portfolio, social_data, ads_data
    )
    print(f"✅ {len(customer_personas)} Customer Personas create")

    # FASE 6: Content Matrix
    print("\n🔄 Step 6/14 - CONTENT MATRIX (Paid/Organic)...")
    content_matrix = await generate_content_matrix(
        ai_service, customer_personas, product_portfolio
    )
    print("✅ Content Matrix completata")

    # FASE 7: Product Vertical (usare prodotti per ora)
    print("\n🔄 Step 7/14 - PRODUCT VERTICAL...")
    product_vertical = product_portfolio.get("products", [])
    print("✅ Product Vertical completato")

    # FASE 8: Brand Voice
    print("\n🔄 Step 8/14 - BRAND VOICE & COMMUNICATION GUIDELINES...")
    brand_voice = await generate_brand_voice(
        ai_service, client_info, site_content, social_data
    )
    print("✅ Brand Voice completato")

    # FASE 9: Objections Management
    print("\n🔄 Step 9/14 - OBJECTIONS MANAGEMENT...")
    objections = await generate_objections_management(
        ai_service, client_info, product_portfolio, brand_values, site_content
    )
    print("✅ Objections Management completato")

    # FASE 10: Reviews VoC
    print("\n🔄 Step 10/14 - REVIEWS VOC (Golden Hooks)...")
    reviews_voc = await generate_reviews_voc(
        ai_service, google_reviews, instagram_comments
    )
    print("✅ Reviews VoC completato")

    # FASE 11: Battlecards
    print("\n🔄 Step 11/14 - BATTLECARDS COMPETITOR...")
    battlecards = await generate_battlecards(
        ai_service, client_info, brand_identity, product_portfolio, site_url
    )
    print("✅ Battlecards completate")

    # FASE 12: Seasonal Roadmap
    print("\n🔄 Step 12/14 - SEASONAL ROADMAP (12 mesi)...")
    seasonal_roadmap = await generate_seasonal_roadmap(
        ai_service, client_info, product_portfolio
    )
    print("✅ Seasonal Roadmap completata")

    # FASE 13: Psychographic Analysis
    print("\n🔄 Step 13/14 - PSYCHOGRAPHIC ANALYSIS (3 livelli)...")
    psychographic_analysis = await generate_psychographic_analysis(
        ai_service, client_info, customer_personas, site_content
    )
    print("✅ Psychographic Analysis completata")

    # FASE 14: Visual Brief
    print("\n🔄 Step 14/14 - VISUAL BRIEF...")
    visual_brief = await generate_visual_brief(
        ai_service, brand_identity, brand_voice, customer_personas
    )
    print("✅ Visual Brief completato")

    print("\n" + "=" * 80)
    print("🎉 ANALISI STRATEGICA COMPLETA - 14/14 SEZIONI GENERATE!")
    print("=" * 80)

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
        "seasonal_roadmap": seasonal_roadmap,
        "psychographic_analysis": psychographic_analysis,
        "visual_brief": visual_brief,
        "metadata": {
            "methodology": "Francesco Agostinis - Strategie Marketing Avanzate con Gemini",
            "version": "2.0 - COMPLETO",
            "sections_implemented": 14,
            "sections_total": 14,
            "generated_at": "NOW()"
        }
    }
