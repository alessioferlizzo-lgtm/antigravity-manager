"""
ANALISI COMPLETA — PART 4: Sezioni 13 e 14
Analisi Psicografica + Visual Brief
"""

import json


async def generate_psychographic_analysis(ai_service, client_info: dict, site_url: str, social_data: dict, ads_data: list, customer_personas: list):
    """
    SEZIONE 13: Analisi Psicografica — 3 Livelli di Profondità

    Analizza i clienti ideali su 3 livelli psicologici:
    - Livello 1: Consapevole (cosa dicono di volere)
    - Livello 2: Identitario (come vogliono essere visti)
    - Livello 3: Inconscio (trigger archetipici profondi)
    """

    client_name = client_info.get("name", "")

    # Costruisci contesto dalle personas generate
    personas_context = ""
    if customer_personas and isinstance(customer_personas, list):
        personas_context = "\n\nCUSTOMER PERSONAS GENERATE:\n"
        for i, p in enumerate(customer_personas[:5], 1):
            personas_context += f"\nPersona {i}: {p.get('nome', '')}\n"
            personas_context += f"Profilo: {p.get('profilo', '')[:200]}\n"
            personas_context += f"Desideri: {p.get('desideri_profondi', '')[:150]}\n"
            personas_context += f"Paure: {p.get('paure_blocchi', '')[:150]}\n"

    # Dati social per insights comportamentali
    social_context = ""
    if social_data.get("posts"):
        top_posts = sorted(social_data["posts"], key=lambda x: x.get("engagement", 0), reverse=True)[:3]
        social_context = "\n\nTOP POST INSTAGRAM (maggior engagement):\n"
        for post in top_posts:
            social_context += f"- {post.get('caption', '')[:100]} (Engagement: {post.get('engagement', 0)})\n"

    system_prompt = f"""Sei uno psicologo del consumatore e stratega di marketing con 20 anni di esperienza.
Il tuo compito è creare un'analisi psicografica profonda a 3 livelli del cliente ideale di {client_name}.

CONTESTO DISPONIBILE:
{personas_context}
{social_context}

Sito web: {site_url}

STRUTTURA ANALISI:

LIVELLO 1 — PSICOGRAFIA PRIMARIA (consapevole, dichiarata):
- Cosa dice di volere
- Obiettivi espliciti
- Desideri consapevoli
- Pain points dichiarati

LIVELLO 2 — PSICOGRAFIA SECONDARIA (emotiva, identitaria):
- Come vuole essere visto dagli altri
- Identità aspirazionale
- Valori e credenze core
- Tribù di appartenenza (chi sono "loro")
- Paure sociali (giudizio, fallimento, esclusione)

LIVELLO 3 — PSICOGRAFIA TERZIARIA (inconscia, archetipica):
- Archetipi psicologici attivi (Eroe, Ribelle, Amante, Saggio, ecc.)
- Trigger inconsci che guidano l'acquisto
- La vera ragione per cui compra (spesso diversa da quella dichiarata)
- Narrative interiori ("sono il tipo di persona che...")
- Come il prodotto risolve un conflitto identitario profondo

OUTPUT JSON:
{{
  "level_1_primary": {{
    "desires": "cosa vuole consapevolmente",
    "explicit_goals": ["goal 1", "goal 2", "goal 3"],
    "declared_pain_points": ["pain 1", "pain 2", "pain 3"],
    "what_they_say": "come descrivono il loro problema"
  }},
  "level_2_secondary": {{
    "aspirational_identity": "chi vuole essere/sembrare",
    "core_values": ["valore 1", "valore 2", "valore 3"],
    "tribe": "a quale gruppo vuole appartenere",
    "social_fears": ["paura sociale 1", "paura 2"],
    "identity_statement": "Sono il tipo di persona che..."
  }},
  "level_3_unconscious": {{
    "archetypes": "archetipi psicologici dominanti",
    "real_purchase_reason": "la vera ragione inconscia per cui compra",
    "unconscious_triggers": ["trigger 1", "trigger 2", "trigger 3"],
    "identity_conflict": "quale conflitto interiore risolve il prodotto",
    "deepest_fear": "la paura più profonda da non nominare mai esplicitamente"
  }},
  "copywriting_implications": {{
    "words_that_activate": ["parola/frase che risuona 1", "parola 2", "parola 3"],
    "words_to_avoid": ["parola da evitare 1", "parola 2"],
    "best_hook_types": ["tipo di hook 1", "tipo 2", "tipo 3"],
    "narrative_arc": "la storia che risuona di più con questa psicografia"
  }}
}}

Rispondi SOLO con JSON valido."""

    result = await ai_service._call_ai(
        model="anthropic/claude-sonnet-4-5",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Genera analisi psicografica completa a 3 livelli per il cliente ideale di {client_name}"}
        ],
        temperature=0.5,
        max_tokens=3000
    )

    import json_repair
    return json_repair.loads(result)


async def generate_visual_brief(ai_service, client_info: dict, brand_identity: dict, brand_voice: dict, site_url: str, social_data: dict):
    """
    SEZIONE 14: Visual Brief — Linee Guida per Designer e Videomaker

    Brief visivo completo con:
    - Mood & Aesthetic
    - Color Palette
    - Typography
    - Do's & Don'ts
    - Hook visivi (primi 3 secondi)
    - Struttura video timing
    """

    client_name = client_info.get("name", "")

    # Estrai info brand identity
    brand_context = ""
    if brand_identity:
        brand_context = f"\n\nBRAND IDENTITY:\n"
        brand_context += f"Posizionamento: {brand_identity.get('posizionamento', '')}\n"
        brand_context += f"Essenza: {brand_identity.get('essenza_brand', '')}\n"
        brand_context += f"Personalità: {brand_identity.get('personalita', '')}\n"

    # Brand voice per coherenza visiva
    voice_context = ""
    if brand_voice:
        voice_context = f"\n\nBRAND VOICE:\n"
        voice_context += f"Tono: {brand_voice.get('tone_of_voice', '')}\n"
        voice_context += f"Stile comunicazione: {brand_voice.get('stile_comunicazione', '')}\n"

    system_prompt = f"""Sei un Creative Director con esperienza in brand identity e advertising per Meta/TikTok.
Genera un Visual Brief professionale per {client_name} che possa essere consegnato direttamente a designer e videomaker.

CONTESTO:
{brand_context}
{voice_context}

Sito web: {site_url}

Il brief deve coprire:
1. MOOD & AESTHETIC: Atmosfera visiva del brand
2. COLOR PALETTE: Colori principali e come usarli
3. TYPOGRAPHY DIRECTION: Stile tipografico
4. CREATIVE FORMATS: Specifiche per ogni formato Meta Ads
5. DO's: Cosa includere sempre nelle creatività
6. DON'Ts: Cosa non fare mai
7. TARGET VISUAL CUES: Elementi visivi che risuonano con il target
8. HOOK VISIVI: Prime 3 secondi del video — cosa deve succedere a schermo
9. REFERENCE AESTHETIC: Tipo di stile/mood di riferimento (es: "clean minimalista", "energico urban", ecc.)
10. VIDEO BRIEF: Struttura video consigliata (timing preciso)

OUTPUT JSON:
{{
  "mood_aesthetic": "descrizione dell'atmosfera visiva",
  "color_palette": {{
    "primary": ["#colore1", "#colore2"],
    "secondary": ["#colore3"],
    "usage_notes": "come usare i colori nelle ads"
  }},
  "typography": "direzione tipografica (es: 'Sans-serif bold moderno', 'Serif elegante', ecc.)",
  "dos": ["cosa fare 1", "cosa fare 2", "cosa fare 3", "cosa fare 4"],
  "donts": ["cosa NON fare 1", "cosa NON fare 2", "cosa NON fare 3"],
  "target_visual_cues": ["elemento visivo che risuona 1", "elemento 2", "elemento 3"],
  "visual_hooks_3sec": ["hook visivo per i primi 3 secondi 1", "hook 2", "hook 3", "hook 4"],
  "reference_aesthetic": "stile di riferimento (descrivi il mood/vibe generale)",
  "formats": {{
    "stories_9x16": "brief specifico per Stories (verticale)",
    "feed_4x5": "brief specifico per Feed (quadrato/rettangolare)",
    "reels": "brief specifico per Reels (video brevi)"
  }},
  "video_structure": {{
    "0_3s": "cosa succede nei primi 3 secondi (hook visivo che ferma lo scroll)",
    "3_15s": "sviluppo 3-15 secondi (dimostrazione, benefici, storytelling)",
    "15_30s": "chiusura e CTA 15-30 secondi (call to action chiara)"
  }}
}}

Rispondi SOLO con JSON valido."""

    result = await ai_service._call_ai(
        model="anthropic/claude-sonnet-4-5",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Genera il visual brief completo per {client_name}"}
        ],
        temperature=0.6,
        max_tokens=2500
    )

    import json_repair
    return json_repair.loads(result)
