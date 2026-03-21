# 🔗 PIANO INTEGRAZIONE SISTEMA UNIFICATO

## 🎯 OBIETTIVO
Ogni generatore (Copy, Script, Graphics, Angoli) deve avere accesso **COMPLETO** all'Analisi Strategica (14 sezioni) + Brand Identity (logo, colori, font).

---

## 📋 MODIFICHE DA FARE

### 1. **Helper Unificato** (nuovo)
Creo funzione `_load_strategic_analysis()` che:
- Legge Analisi Strategica da Supabase (14 sezioni JSONB)
- Legge Brand Identity da metadata (logo, colori, font)
- Ritorna tutto in formato testo strutturato per AI

```python
async def _load_strategic_analysis(client_id: str) -> dict:
    """
    Carica TUTTA l'intelligence del cliente:
    - 14 sezioni Analisi Strategica (da Supabase)
    - Brand Identity (logo, colori, font da metadata)
    - Restituisce dict pronto per AI context
    """
    # 1. Fetch da Supabase
    result = await supabase.table("client_complete_analysis").select("*").eq("client_id", client_id).execute()
    analysis = result.data[0] if result.data else {}

    # 2. Fetch metadata per logo/colori/font
    metadata = storage_service.get_metadata(client_id)
    brand_identity = metadata.get("brand_identity", {})

    return {
        "analysis": analysis,  # Tutte le 14 sezioni
        "brand_identity": brand_identity,  # Logo, colori, font
        "client_name": metadata.get("name", "")
    }
```

### 2. **Copy Generator** — Modifica `generate_copy()`
**PRIMA** (usa solo VoC + research):
```python
# Legge solo voc_analysis.json e market_research.md
voc_text = "..."
research_text = "..."
```

**DOPO** (usa Analisi Strategica completa):
```python
strategic_data = await _load_strategic_analysis(client_id)
analysis = strategic_data["analysis"]

context = f"""
ANALISI STRATEGICA COMPLETA:

BRAND IDENTITY: {json.dumps(analysis.get('brand_identity', {}), ensure_ascii=False)}
BRAND VOICE: {json.dumps(analysis.get('brand_voice', {}), ensure_ascii=False)}
CUSTOMER PERSONAS (10 ICP): {json.dumps(analysis.get('customer_personas', []), ensure_ascii=False)[:2000]}
REASONS TO BUY: {json.dumps(analysis.get('reasons_to_buy', {}), ensure_ascii=False)}
OBIEZIONI DA GESTIRE: {json.dumps(analysis.get('objections', {}), ensure_ascii=False)}
VOICE OF CUSTOMER (Golden Hooks): {json.dumps(analysis.get('reviews_voc', {}), ensure_ascii=False)[:1000]}
ANALISI PSICOGRAFICA: {json.dumps(analysis.get('psychographic_analysis', {}), ensure_ascii=False)[:1500]}
"""
```

### 3. **Script Generator** — Modifica `generate_script_endpoint()`
**PRIMA**:
```python
research = "solo market_research.md"
buyer_personas = metadata.get("brand_identity", {}).get("buyer_personas", [])
```

**DOPO**:
```python
strategic_data = await _load_strategic_analysis(client_id)
analysis = strategic_data["analysis"]

context = f"""
ANALISI STRATEGICA COMPLETA:

CUSTOMER PERSONAS: {json.dumps(analysis.get('customer_personas', []), ensure_ascii=False)}
BRAND VOICE: {json.dumps(analysis.get('brand_voice', {}), ensure_ascii=False)}
VISUAL BRIEF (struttura video 0-3s, 3-15s, 15-30s): {json.dumps(analysis.get('visual_brief', {}), ensure_ascii=False)}
PRODUCT VERTICAL (quale prodotto spingere): {json.dumps(analysis.get('product_vertical', []), ensure_ascii=False)[:2000]}
ANALISI PSICOGRAFICA (trigger emotivi): {json.dumps(analysis.get('psychographic_analysis', {}), ensure_ascii=False)[:1500]}
"""
```

### 4. **Angoli Generator** — Modifica `get_angles()`
**PRIMA**:
```python
research_content = market_research.md + buyer_personas
```

**DOPO**:
```python
strategic_data = await _load_strategic_analysis(client_id)
analysis = strategic_data["analysis"]

context = f"""
ANALISI STRATEGICA COMPLETA:

BRAND IDENTITY: {json.dumps(analysis.get('brand_identity', {}), ensure_ascii=False)}
CUSTOMER PERSONAS: {json.dumps(analysis.get('customer_personas', []), ensure_ascii=False)[:2000]}
REASONS TO BUY: {json.dumps(analysis.get('reasons_to_buy', {}), ensure_ascii=False)}
COMPETITOR BATTLECARDS (per differenziazione): {json.dumps(analysis.get('battlecards', {}), ensure_ascii=False)[:2000]}
ANALISI PSICOGRAFICA (trigger inconsci): {json.dumps(analysis.get('psychographic_analysis', {}), ensure_ascii=False)[:1500]}
OBIEZIONI DA SMONTARE: {json.dumps(analysis.get('objections', {}), ensure_ascii=False)}
"""
```

### 5. **Graphics Generator** — Nuovo endpoint `generate_graphic()`
**CREARE DA ZERO** (se non esiste già):
```python
@app.post("/clients/{client_id}/graphics/generate")
async def generate_graphic(client_id: str, request: GraphicRequest):
    strategic_data = await _load_strategic_analysis(client_id)
    analysis = strategic_data["analysis"]
    brand = strategic_data["brand_identity"]

    # Estrai Brand Identity visiva
    logo_url = brand.get("logo_url", "")
    colors = brand.get("colors", [])
    fonts = brand.get("fonts", "")

    # Estrai Visual Brief
    visual_brief = analysis.get("visual_brief", {})
    mood = visual_brief.get("mood_aesthetic", "")
    dos = visual_brief.get("dos", [])
    donts = visual_brief.get("donts", [])

    # Estrai info prodotto
    product_portfolio = analysis.get("product_portfolio", {})

    prompt_for_ai = f"""
    Genera un'immagine per Meta Ads per il brand {strategic_data['client_name']}.

    BRAND IDENTITY VISIVA:
    - Colori primari: {', '.join(colors)}
    - Font: {fonts}
    - Mood: {mood}
    - DO's: {', '.join(dos)}
    - DON'Ts: {', '.join(donts)}

    PRODOTTO DA MOSTRARE:
    {json.dumps(product_portfolio, ensure_ascii=False)[:500]}

    RICHIESTA UTENTE:
    {request.user_prompt}

    STILE: {visual_brief.get("reference_aesthetic", "professionale e moderno")}
    """

    # Chiama Fal.ai o altro generatore immagini
    image_url = await generate_image_with_fal(prompt_for_ai)

    # Overlay logo se richiesto
    if request.include_logo and logo_url:
        image_url = await add_logo_overlay(image_url, logo_url)

    return {"image_url": image_url, "prompt_used": prompt_for_ai}
```

---

## 🔧 IMPLEMENTAZIONE

### File da modificare:
1. ✅ **backend/main.py** — Aggiungi `_load_strategic_analysis()`
2. ✅ **backend/main.py** — Modifica `generate_copy()` (riga ~1471)
3. ✅ **backend/main.py** — Modifica `generate_script_endpoint()` (riga ~2734)
4. ✅ **backend/main.py** — Modifica `get_angles()` (riga ~1195)
5. ✅ **backend/main.py** — Crea `generate_graphic()` (nuovo endpoint)

### Input Utente (Frontend):
Ogni sezione avrà:
```tsx
<textarea
  placeholder="Prompt opzionale: personalizza la generazione..."
  value={customPrompt}
  onChange={e => setCustomPrompt(e.target.value)}
/>
<button onClick={() => generate(customPrompt)}>
  Genera con Analisi Strategica
</button>
```

Se l'utente lascia vuoto → usa solo Analisi Strategica
Se compila → Analisi Strategica + prompt custom

---

## ⏱️ TEMPO STIMATO
- Helper function: **10 min**
- Copy Generator: **15 min**
- Script Generator: **15 min**
- Angoli Generator: **10 min**
- Graphics Generator: **30 min** (nuovo endpoint + Fal.ai integration)
- Frontend update: **20 min**

**TOTALE: ~1h 40min**

---

## 🎯 RISULTATO ATTESO

Dopo integrazione:

✅ **Copy Generator**:
- Usa Brand Voice, Customer Personas, Psicografia, VoC, Obiezioni
- Genera copy perfettamente allineato al brand

✅ **Script Generator**:
- Usa Visual Brief (timing 0-3s, 3-15s), Personas, Prodotto, Psicografia
- Genera script con struttura perfetta e trigger emotivi

✅ **Angoli Generator**:
- Usa Battlecards, Personas, Psicografia, RTB, Obiezioni
- Genera angoli differenzianti vs competitor

✅ **Graphics Generator**:
- Usa Visual Brief (mood, colori, font, logo), Prodotto
- Genera immagini on-brand automaticamente

---

**Status**: 📝 Piano pronto
**Next**: Attendere conferma utente per procedere con implementazione
