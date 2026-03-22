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


def format_instagram_data(social_data_json: str) -> str:
    """
    Formatta i dati Instagram da JSON grezzo a testo leggibile per l'AI.

    Trasforma:
    {"account": {...}, "posts": [...]}

    In testo strutturato con:
    - Info account (followers, bio)
    - Top post con engagement
    - Commenti più significativi
    """
    try:
        if not social_data_json or social_data_json == "Non disponibili":
            return "Dati Instagram non disponibili"

        data = json.loads(social_data_json) if isinstance(social_data_json, str) else social_data_json

        # Se c'è un errore nei dati
        if isinstance(data, dict) and "error" in data:
            return f"Errore raccolta Instagram: {data['error']}"

        # Estrai info account
        account = data.get("account", {})
        posts = data.get("posts", [])

        formatted = f"""
📸 INSTAGRAM - @{account.get('username', 'N/A')}

👥 METRICHE ACCOUNT:
   • Follower: {account.get('followers', 0):,}
   • Post totali: {account.get('posts_count', 0)}
   • Bio: {account.get('bio', 'N/A')}

🔥 TOP POST (ordinati per engagement):
"""

        # Mostra top 30 post con engagement
        for i, post in enumerate(posts[:30], 1):
            caption = post.get('caption', '')[:200] if post.get('caption') else '[Nessun caption]'
            likes = post.get('like_count', 0)
            comments_count = post.get('comments_count', 0)
            engagement = likes + (comments_count * 2)

            formatted += f"\n{i}. POST (Engagement: {engagement:,} | ❤️ {likes} | 💬 {comments_count})"
            formatted += f"\n   Caption: {caption}{'...' if len(post.get('caption', '')) > 200 else ''}\n"

            # Mostra top commenti se presenti
            all_comments = post.get('all_comments', [])
            if all_comments:
                # Ordina per like
                top_comments = sorted(all_comments, key=lambda c: c.get('like_count', 0), reverse=True)[:5]
                if top_comments:
                    formatted += "   💬 Top commenti:\n"
                    for comment in top_comments:
                        text = comment.get('text', '')[:150]
                        likes_c = comment.get('like_count', 0)
                        formatted += f"      - {text} (❤️ {likes_c})\n"

        formatted += f"\n📊 TOTALE: {data.get('total_posts', 0)} post raccolti, {data.get('total_comments', 0)} commenti analizzati\n"

        return formatted

    except Exception as e:
        return f"Errore formattazione dati Instagram: {str(e)}\n\nDati grezzi (primi 2000 char):\n{social_data_json[:2000]}"


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
        metadata = client_info.get("metadata", {})

        # 🔥 ARRICCHIMENTO DATI DAL METADATA
        swot = metadata.get("swot", {})
        links = metadata.get("links", [])
        competitors = metadata.get("competitors", [])
        objectives = metadata.get("objectives", {})
        preferences = metadata.get("preferences", {})
        key_products = metadata.get("key_products", [])

        # Formatta i link in modo leggibile
        links_text = "\n".join([f"- {link.get('url', link) if isinstance(link, dict) else link}" for link in links[:10]])

        # Formatta competitor
        competitors_text = ""
        for comp in competitors[:5]:
            comp_name = comp.get("name", "")
            comp_links = comp.get("links", [])
            competitors_text += f"\n**{comp_name}:**\n"
            for cl in comp_links[:3]:
                competitors_text += f"  - {cl.get('label', '')}: {cl.get('url', '')}\n"

        # Formatta prodotti chiave
        products_text = "\n".join([f"- {p}" for p in key_products[:10]]) if key_products else "Non specificati"

        # Formatta tone & vocabolario target
        tone_pref = preferences.get("tone", "")
        target_vocab = preferences.get("target_vocabulary", [])
        vocab_text = ", ".join(target_vocab[:15]) if target_vocab else "Non specificato"

        # 🔥 FORMATTA DATI INSTAGRAM IN MODO LEGGIBILE
        instagram_formatted = format_instagram_data(social_data) if social_data else "Dati Instagram non disponibili"

        system_prompt = f"""Agisci come un Senior Brand Strategist & Marketing Analyst con esperienza in e-commerce D2C (Direct-to-Consumer).

Il tuo compito è analizzare a fondo TUTTI i dati forniti e creare la sezione "BRAND IDENTITY & POSIZIONAMENTO" della Knowledge Base Strategica.

CONTESTO CLIENTE:
Nome: {client_name}
Settore: {industry}
Sito Web: {site_url}

🌐 LINK E SORGENTI:
{links_text}

📦 PRODOTTI CHIAVE:
{products_text}

💪 PUNTI DI FORZA (SWOT):
{swot.get('strengths', 'Non specificati')}

🎯 OPPORTUNITÀ:
{swot.get('opportunities', 'Non specificato')}

🗣️ TONO DI VOCE PREFERITO:
{tone_pref if tone_pref else "Non specificato"}

📝 VOCABOLARIO TARGET (come parla il pubblico):
{vocab_text}

⚔️ COMPETITOR PRINCIPALI:
{competitors_text if competitors_text else "Non specificati"}

CONTENUTO SITO WEB:
{site_content[:8000] if site_content else "Non disponibile"}

{instagram_formatted}

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
✅ Basa tutto sui DATI forniti sopra (SWOT, prodotti, vocabolario, competitor, tone), non inventare
✅ Usa elenchi puntati per massima leggibilità
✅ Ogni affermazione deve essere supportata da evidenze dai dati forniti
❌ VIETATO dire "dati non disponibili" o "impossibile determinare" - USA I DATI FORNITI SOPRA (SWOT, prodotti chiave, vocabolario target, tone preferito, competitor)
✅ Se il sito web non è accessibile, usa comunque SWOT, prodotti, competitor e vocabolario per costruire l'analisi

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
}}

NOTA IMPORTANTE: NON generare la sezione "visual_identity" (colori, design, packaging) perché verrà inserita MANUALMENTE dall'utente nella sezione Identità dell'app."""

        try:
            response = await self.ai_service._call_ai(
                model="anthropic/claude-3.5-sonnet",
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

        # 🔥 FORMATTA DATI INSTAGRAM
        instagram_formatted = format_instagram_data(social_data) if social_data else "Dati Instagram non disponibili"

        system_prompt = f"""Agisci come un Senior Brand Strategist.

Il tuo compito è identificare i VALORI DEL BRAND (Brand Pillars) - i pilastri etici e morali su cui si fonda {client_name}.

CONTESTO:
Sito Web: {site_url}

CONTENUTO SITO:
{site_content[:8000]}

{instagram_formatted}

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
                return {"brand_pillars": [], "raw_text": response}

        except Exception as e:
            print(f"Errore generazione Brand Values: {e}")
            return {"brand_pillars": [], "error": str(e)}

    async def generate_product_portfolio(
        self,
        client_info: Dict[str, Any],
        site_url: str,
        site_content: str,
        raw_docs: str = "",
        products_csv: str = "",
        services_txt: str = ""
    ) -> Dict[str, Any]:
        """
        SEZIONE 3: ANALISI PORTAFOGLIO PRODOTTI E SERVIZI

        Analisi verticale di PRODOTTI (da CSV Shopify) e SERVIZI (da TXT o sito):
        - Nome & Categoria
        - Benefit/Tecnologia
        - Ingredienti Chiave (prodotti) o Descrizione (servizi)
        - USP (Unique Selling Proposition)
        - Problema Cliente che risolve
        - Marketing Hooks (3 headline pronte)
        """

        client_name = client_info.get("name", "")

        # Determina se abbiamo prodotti, servizi o entrambi
        has_products = bool(products_csv and products_csv != "Non disponibili")
        has_services = bool(services_txt and services_txt != "Non disponibili") or "serviz" in site_content.lower()

        analysis_type = ""
        if has_products and has_services:
            analysis_type = "PRODOTTI E SERVIZI"
        elif has_products:
            analysis_type = "PRODOTTI"
        elif has_services:
            analysis_type = "SERVIZI"
        else:
            analysis_type = "PRODOTTI/SERVIZI (da sito web)"

        system_prompt = f"""Agisci come un Product Marketing Manager esperto.

Il tuo compito è analizzare tecnicamente {analysis_type} di {client_name} e tradurre le caratteristiche tecniche in leve di marketing persuasive.

CONTESTO:
Sito: {site_url}

CONTENUTO SITO (pagine prodotto/servizi):
{site_content[:10000]}

{'📦 PRODOTTI DA CSV SHOPIFY:' if has_products else ''}
{products_csv[:5000] if has_products else ''}

{'🛠️ SERVIZI DA FILE TXT:' if has_services and services_txt else ''}
{services_txt[:5000] if has_services and services_txt else ''}

DOCUMENTI AGGIUNTIVI:
{raw_docs[:3000] if raw_docs else "Non disponibili"}

ISTRUZIONI:
Per OGNI prodotto/servizio identificato, crea un'analisi completa.

### SE È UN PRODOTTO (da CSV Shopify o sito e-commerce):
**ANALISI TECNICA:**
- Materiali/Texture: Di cosa è fatto?
- Tecnologia/Innovazione: Ci sono brevetti o meccanismi particolari?
- Ingredienti Chiave: Quali sono gli attivi principali e cosa fanno?
- Accessori/Formato: Cosa è incluso o qual è il pack?

### SE È UN SERVIZIO (da TXT o sito centro estetico/agenzia):
**ANALISI TECNICA:**
- Descrizione completa del servizio
- Metodologia/Processo utilizzato
- Tecnologie/Tool impiegate
- Durata e modalità di erogazione

### STRATEGIA DI MARKETING (per prodotti E servizi):
- **Problema Cliente**: Quale problema specifico risolve? (es. "pelle che si affloscia", "macchie dell'età", "pochi lead qualificati")
- **Reason to Buy (RTB)**: 3 motivi convincenti per acquistare/prenotare (mix logica ed emozione)
- **ICP Target**: Chi è il cliente ideale per questo prodotto/servizio?
- **USP**: Perché è UNICO sul mercato? Cosa lo differenzia?

### MARKETING HOOKS:
- 3 headline pubblicitarie pronte all'uso (brevi, incisive, persuasive)

OUTPUT JSON:
{{
  "items": [
    {{
      "name": "Nome Prodotto/Servizio",
      "type": "product" oppure "service",
      "category": "Categoria (es. Viso/Corpo/Tool/Marketing/Design)",
      "technical_analysis": {{
        "description": "Descrizione completa",
        "technology": "Tecnologie o metodologia",
        "key_elements": ["Elemento chiave 1", "Elemento chiave 2"],
        "format": "Formato/durata/modalità erogazione"
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
✅ Distingui chiaramente tra "product" e "service" nel campo type
✅ Se hai CSV prodotti Shopify, analizza QUELLI prioritariamente
✅ Se hai file TXT servizi, analizza QUELLI prioritariamente
✅ Se non hai né CSV né TXT, analizza dal sito web
✅ NON fare un semplice elenco - analizza in profondità
✅ Focus su BENEFICI non caratteristiche
✅ Usa linguaggio persuasivo nei hooks
✅ Sii specifico e concreto"""

        try:
            response = await self.ai_service._call_ai(
                model="anthropic/claude-3.5-sonnet",
                messages=[{"role": "user", "content": system_prompt}],
                temperature=0.3,
                max_tokens=6000
            )

            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                # Supporta sia il vecchio formato "products" che il nuovo "items"
                if "items" in data:
                    return data
                elif "products" in data:
                    # Converte vecchio formato in nuovo
                    return {"items": data["products"]}
                return data
            else:
                return {"items": [], "raw_text": response}

        except Exception as e:
            print(f"Errore generazione Product Portfolio: {e}")
            return {"items": [], "error": str(e)}


async def generate_complete_strategic_analysis(
    ai_service,
    client_info: Dict[str, Any],
    site_url: str,
    site_content: str,
    social_data: str = "",
    ads_data: str = "",
    raw_docs: str = "",
    google_reviews: str = "",
    instagram_comments: str = "",
    products_csv: str = "",
    services_txt: str = ""
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

    # FASE 3: Product Portfolio (Prodotti + Servizi)
    print("\n🔄 Step 3/14 - PRODUCT/SERVICE PORTFOLIO (Analisi Verticale)...")
    product_portfolio = await service.generate_product_portfolio(
        client_info, site_url, site_content, raw_docs, products_csv, services_txt
    )
    print("✅ Product/Service Portfolio completato")

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
        ai_service, client_info, site_content, brand_identity, product_portfolio, social_data, ads_data, google_reviews
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

    # ══════════════════════════════════════════════════════════════════
    # SEZIONI AGGIUNTIVE PER METADATA (sostituiscono vecchio sistema)
    # ══════════════════════════════════════════════════════════════════

    print("\n🔄 BONUS 1/3 - SWOT ANALYSIS (aggiornato)...")
    swot_analysis = await generate_swot_from_analysis(
        ai_service, brand_identity, brand_values, battlecards, product_portfolio
    )
    print("✅ SWOT Analysis completata")

    print("\n🔄 BONUS 2/3 - OBIETTIVI STRATEGICI (SMART)...")
    strategic_objectives = await generate_strategic_objectives(
        ai_service, client_info, brand_identity, swot_analysis
    )
    print("✅ Obiettivi Strategici completati")

    print("\n🔄 BONUS 3/3 - STRATEGIA COMPLETA (Piano d'azione)...")
    strategic_plan = await generate_strategic_plan(
        ai_service, client_info, swot_analysis, strategic_objectives, battlecards
    )
    print("✅ Strategia Completa generata")

    print("\n" + "=" * 80)
    print("🎉 ANALISI STRATEGICA COMPLETA - 14 SEZIONI + 3 BONUS GENERATE!")
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
        # NUOVE SEZIONI CHE SOSTITUISCONO IL VECCHIO SISTEMA
        "swot": swot_analysis,
        "objectives": strategic_objectives,
        "strategy": strategic_plan,
        "metadata": {
            "methodology": "Francesco Agostinis - Strategie Marketing Avanzate con Gemini",
            "version": "2.0 - COMPLETO + SWOT/OBIETTIVI/STRATEGIA",
            "sections_implemented": 14,
            "sections_total": 14,
            "generated_at": "NOW()"
        }
    }


# ══════════════════════════════════════════════════════════════════
# FUNZIONI BONUS: SWOT, OBIETTIVI, STRATEGIA
# ══════════════════════════════════════════════════════════════════

async def generate_swot_from_analysis(
    ai_service,
    brand_identity: Dict[str, Any],
    brand_values: Dict[str, Any],
    battlecards: Dict[str, Any],
    product_portfolio: Dict[str, Any]
) -> Dict[str, str]:
    """
    Genera SWOT Analysis aggiornata basandosi sull'analisi completa già generata.
    """

    prompt = f"""Sei un Senior Strategic Analyst. Basandoti sull'analisi strategica completa già generata, crea una SWOT Analysis professionale e dettagliata.

BRAND IDENTITY:
{json.dumps(brand_identity, ensure_ascii=False, indent=2)[:1500]}

BRAND VALUES:
{json.dumps(brand_values, ensure_ascii=False, indent=2)[:1500]}

COMPETITOR BATTLECARDS:
{json.dumps(battlecards, ensure_ascii=False, indent=2)[:1500]}

PRODUCT PORTFOLIO:
{json.dumps(product_portfolio, ensure_ascii=False, indent=2)[:1500]}

Genera una SWOT Analysis in italiano, strutturata e dettagliata.

OUTPUT JSON:
{{
  "strengths": "Punti di forza interni del brand (competenze, asset, differenziatori unici). 3-5 punti concreti.",
  "weaknesses": "Punti deboli interni da migliorare (gap, limiti, aree di vulnerabilità). 3-5 punti onesti.",
  "opportunities": "Opportunità esterne da cogliere (trend di mercato, cambiamenti nel comportamento clienti, nuovi canali). 3-5 punti strategici.",
  "threats": "Minacce esterne (competitor, cambiamenti normativi, crisi settoriali). 3-5 punti realistici."
}}

REGOLE:
✅ Basati SOLO sui dati forniti sopra
✅ Sii specifico e concreto, NO genericità
✅ Ogni punto deve essere actionable e rilevante per Meta Ads"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {
                "strengths": response.split("Strengths:")[1].split("Weaknesses:")[0] if "Strengths:" in response else "",
                "weaknesses": response.split("Weaknesses:")[1].split("Opportunities:")[0] if "Weaknesses:" in response else "",
                "opportunities": response.split("Opportunities:")[1].split("Threats:")[0] if "Opportunities:" in response else "",
                "threats": response.split("Threats:")[1] if "Threats:" in response else ""
            }
    except Exception as e:
        print(f"Errore generazione SWOT: {e}")
        return {"strengths": "", "weaknesses": "", "opportunities": "", "threats": ""}


async def generate_strategic_objectives(
    ai_service,
    client_info: Dict[str, Any],
    brand_identity: Dict[str, Any],
    swot: Dict[str, str]
) -> Dict[str, Any]:
    """
    Genera Obiettivi Strategici SMART basati su brand identity e SWOT.
    """

    client_name = client_info.get("name", "")
    industry = client_info.get("industry", "")

    prompt = f"""Sei un Growth Strategist per Meta Ads. Definisci 3-5 obiettivi strategici SMART per il cliente.

CLIENTE: {client_name}
SETTORE: {industry}

BRAND IDENTITY:
{json.dumps(brand_identity, ensure_ascii=False, indent=2)[:1500]}

SWOT:
{json.dumps(swot, ensure_ascii=False, indent=2)}

Genera obiettivi SMART (Specific, Measurable, Achievable, Relevant, Time-bound) per i prossimi 6-12 mesi.

OUTPUT JSON:
{{
  "obiettivo_1": {{
    "titolo": "Titolo breve dell'obiettivo (es. 'Aumentare Lead Qualificati del 40%')",
    "smart": "Descrizione completa SMART: Specifico, Misurabile, Achievable, Rilevante, Time-bound",
    "valore_atteso": "Impatto economico/strategico stimato"
  }},
  "obiettivo_2": {{...}},
  "obiettivo_3": {{...}}
}}

REGOLE:
✅ Obiettivi concreti e misurabili
✅ Realistici per una strategia Meta Ads
✅ Allineati con i punti di forza e opportunità SWOT"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=3000
        )

        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"raw_text": response}
    except Exception as e:
        print(f"Errore generazione Obiettivi: {e}")
        return {"error": str(e)}


async def generate_strategic_plan(
    ai_service,
    client_info: Dict[str, Any],
    swot: Dict[str, str],
    objectives: Dict[str, Any],
    battlecards: Dict[str, Any]
) -> str:
    """
    Genera Piano Strategico completo 6-12 mesi basato su SWOT, obiettivi e competitive intelligence.
    """

    client_name = client_info.get("name", "")
    industry = client_info.get("industry", "")

    prompt = f"""Sei un Senior Marketing Strategist. Crea un piano strategico d'azione 6-12 mesi per Meta Ads.

CLIENTE: {client_name}
SETTORE: {industry}

SWOT:
{json.dumps(swot, ensure_ascii=False, indent=2)}

OBIETTIVI:
{json.dumps(objectives, ensure_ascii=False, indent=2)[:1500]}

COMPETITOR INTELLIGENCE:
{json.dumps(battlecards, ensure_ascii=False, indent=2)[:1500]}

Genera un piano strategico in italiano strutturato per fasi temporali (MESE 1-2, MESE 3-4, MESE 5-6).

STRUTTURA:
### PIANO STRATEGICO: [Unique Strategic Position]

**MESE 1-2: [Fase Iniziale - es. BRAND AWARENESS]**
- Azione 1 concreta
- Azione 2 concreta
- KPI da monitorare

**MESE 3-4: [Fase Crescita - es. LEAD GENERATION]**
- Azione 1 concreta
- Azione 2 concreta
- KPI da monitorare

**MESE 5-6: [Fase Scalabilità - es. CONVERSIONE]**
- Azione 1 concreta
- Azione 2 concreta
- KPI da monitorare

**STRATEGIA ANTAGONISTA:**
Posizionamento differenziante rispetto ai competitor (analizza battlecards e definisci come distinguerti).

REGOLE:
✅ Azioni concrete e implementabili
✅ Focus su Meta Ads (FB/IG/WhatsApp)
✅ Sfrutta i punti di forza SWOT
✅ Capitalizza sulle opportunità di mercato
✅ Neutralizza i competitor (usa battlecards)"""

    try:
        response = await ai_service._call_ai(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=4000
        )

        return response
    except Exception as e:
        print(f"Errore generazione Strategia: {e}")
        return f"Errore: {str(e)}"
