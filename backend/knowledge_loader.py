"""
Knowledge Loader — Carica i file di conoscenza dalla directory backend/knowledge/
e li rende disponibili come stringhe per tutti i generatori AI.

Struttura della conoscenza:
- Livelli di Consapevolezza (Schwartz): DOVE si trova l'utente → scelta del messaggio
- Inspirational Stair (Borzacchiello): COME strutturare il messaggio → sequenza persuasiva
- Regole di Scrittura (Vignali): MECCANICA di scrittura → qualità del testo
- Modelli Narrativi (Dosio): MODO DI RACCONTARE → angolazione narrativa
- Framework Copy (10+1): STRUTTURA del copy → quale framework usare in quale contesto
"""

from pathlib import Path

_KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"


def _load_file(filename: str) -> str:
    """Legge un file di conoscenza e lo restituisce come stringa."""
    path = _KNOWLEDGE_DIR / filename
    if not path.exists():
        print(f"⚠️  Knowledge file non trovato: {path}")
        return ""
    return path.read_text(encoding="utf-8")


# ── Pre-load all knowledge at import time ────────────────────────────────────

AWARENESS_INTRO_KNOWLEDGE = _load_file("consapevolezza_intro.md")
INSPIRATIONAL_STAIR_KNOWLEDGE = _load_file("inspirational_stair.md")
VIGNALI_KNOWLEDGE = _load_file("scrittura_vignali.md")
DOSIO_KNOWLEDGE = _load_file("narrativa_dosio.md")
FRAMEWORK_COPY_KNOWLEDGE = _load_file("framework_copy.md")

# Mapping: awareness_level key → file specifico + label italiano
AWARENESS_LEVELS = {
    "unaware":        {"label": "COMPLETAMENTE INCONSAPEVOLE (Unaware)",        "file": "consapevolezza_1_unaware.md"},
    "problem_aware":  {"label": "CONSAPEVOLE DEL PROBLEMA (Problem Aware)",     "file": "consapevolezza_2_problem_aware.md"},
    "solution_aware": {"label": "CONSAPEVOLE DELLA SOLUZIONE (Solution Aware)", "file": "consapevolezza_3_solution_aware.md"},
    "product_aware":  {"label": "CONSAPEVOLE DEL PRODOTTO (Product Aware)",     "file": "consapevolezza_4_product_aware.md"},
    "most_aware":     {"label": "PIENAMENTE CONSAPEVOLE (Most Aware)",          "file": "consapevolezza_5_most_aware.md"},
}


def get_awareness_context(awareness_level: str = "") -> str:
    """
    Restituisce il contesto sui livelli di consapevolezza.
    Se viene specificato un livello, carica SOLO il file di quel livello + l'intro.
    Se non specificato, carica solo l'intro generale.
    """
    if not AWARENESS_INTRO_KNOWLEDGE:
        return ""

    context = f"\n{'='*60}\nFRAMEWORK LIVELLI DI CONSAPEVOLEZZA (Eugene Schwartz)\n{'='*60}\n{AWARENESS_INTRO_KNOWLEDGE}\n"

    if awareness_level and awareness_level in AWARENESS_LEVELS:
        level_info = AWARENESS_LEVELS[awareness_level]
        level_content = _load_file(level_info["file"])
        if level_content:
            context += f"\n{'='*60}\nLIVELLO TARGET SELEZIONATO: {level_info['label']}\n{'='*60}\n{level_content}\n"
            context += f"\nAdatta TUTTO l'output alle leve chimiche e all'obiettivo comunicativo di questo specifico livello.\n"

    return context


def get_writing_knowledge() -> str:
    """
    Restituisce la conoscenza sulla qualità di scrittura (Vignali + Dosio).
    Queste sono regole trasversali che si applicano a QUALSIASI output scritto.
    """
    parts = []
    if VIGNALI_KNOWLEDGE:
        parts.append(f"\n{'='*60}\nREGOLE DI SCRITTURA (Vignali)\n{'='*60}\n{VIGNALI_KNOWLEDGE}")
    if DOSIO_KNOWLEDGE:
        parts.append(f"\n{'='*60}\nMODELLI NARRATIVI (Dosio)\n{'='*60}\n{DOSIO_KNOWLEDGE}")
    return "\n".join(parts)


def get_inspirational_stair() -> str:
    """
    Restituisce il framework Inspirational Stair di Borzacchiello.
    Usato come framework strutturale per script video (default) e copy (quando selezionato).
    """
    if not INSPIRATIONAL_STAIR_KNOWLEDGE:
        return ""
    return f"\n{'='*60}\nFRAMEWORK PERSUASIVO: INSPIRATIONAL STAIR (Borzacchiello)\n{'='*60}\n{INSPIRATIONAL_STAIR_KNOWLEDGE}\n"


def get_script_knowledge(awareness_level: str = "") -> str:
    """
    Restituisce TUTTA la conoscenza necessaria per generare script video:
    - Inspirational Stair come struttura di default
    - Regole di scrittura e modelli narrativi come supporto
    - Livelli di consapevolezza come contesto strategico
    """
    parts = [
        get_inspirational_stair(),
        get_writing_knowledge(),
        get_awareness_context(awareness_level),
    ]
    return "\n".join(p for p in parts if p)


def get_single_framework_knowledge(framework_key: str) -> str:
    """
    Estrae la sezione specifica di un framework dal file framework_copy.md.
    Iniezione mirata: ritorna SOLO il blocco del framework richiesto (non tutti gli altri).
    """
    if not FRAMEWORK_COPY_KNOWLEDGE:
        return ""

    # Mapping: chiave framework → identificatore univoco nel titolo della sezione
    FRAMEWORK_HEADINGS = {
        "BAB":          "1) Before",
        "PAS":          "2) Problem",
        "FAB":          "3) Features",
        "AIDA":         "4) AIDA",
        "4C":           "5) Le 4C",
        "4U":           "6) Le 4U",
        "5_OBIEZIONI":  "7) 5 Obiezioni",
        "3_MOTIVI":     "8) 3 Motivi",
        "ACCA":         "9) ACCA",
        "SSS":          "10) SSS",
        "E_QUINDI":     "10+1",
        "HOOK_BODY_CTA":"Hook",
    }

    heading_id = FRAMEWORK_HEADINGS.get(framework_key)
    if not heading_id:
        return ""

    # Splitta per sezioni "## ..." e trova quella corretta
    sections = FRAMEWORK_COPY_KNOWLEDGE.split("\n## ")
    for section in sections:
        if section.startswith(heading_id) or heading_id in section[:60]:
            # Restituisce max 3000 chars della sezione (include struttura + esempio + istruzioni AI)
            return f"## {section.strip()[:3000]}"

    return ""


def get_copy_knowledge(framework: str = "", awareness_level: str = "") -> str:
    """
    Restituisce la conoscenza necessaria per generare copy.
    Iniezione MIRATA: solo il framework selezionato + note operative + Vignali + consapevolezza.
    NON inietta tutti i 10+1 framework — risparmio token e focus massimo.

    - INSPIRATIONAL_STAIR → inietta il file completo inspirational_stair.md (framework neurochimico)
    - Altri framework → inietta SOLO la sezione specifica da framework_copy.md
    - Sempre: note operative generali, Vignali, Dosio, livelli di consapevolezza
    """
    parts = []

    # 1. INSPIRATIONAL_STAIR — framework neurochimico completo (file dedicato)
    if framework == "INSPIRATIONAL_STAIR":
        parts.append(get_inspirational_stair())

    # 2. Framework specifico selezionato (sezione mirata, non il file intero)
    if framework and framework != "INSPIRATIONAL_STAIR":
        fw_section = get_single_framework_knowledge(framework)
        if fw_section:
            parts.append(f"\n{'='*60}\nFRAMEWORK SELEZIONATO — ISTRUZIONI DETTAGLIATE\n{'='*60}\n{fw_section}\n{'='*60}\n")

    # 3. Note operative generali per il copy (sempre — solo la sezione finale del file)
    if FRAMEWORK_COPY_KNOWLEDGE:
        notes_marker = "## Note operative per l'AI"
        notes_idx = FRAMEWORK_COPY_KNOWLEDGE.find(notes_marker)
        if notes_idx != -1:
            notes_text = FRAMEWORK_COPY_KNOWLEDGE[notes_idx:notes_idx + 1200]
            parts.append(f"\n{'='*60}\nREGOLE OPERATIVE COPY\n{'='*60}\n{notes_text}\n")

    # 4. Regole di scrittura Vignali + Modelli narrativi Dosio (sempre)
    parts.append(get_writing_knowledge())

    # 5. Livelli di consapevolezza con eventuale livello target selezionato (sempre)
    parts.append(get_awareness_context(awareness_level))

    return "\n".join(p for p in parts if p)


def get_full_knowledge() -> str:
    """
    Restituisce TUTTA la conoscenza disponibile.
    Usata da ARIA come knowledge base generale (non per singola generazione copy).
    Include: Livelli di Consapevolezza, Inspirational Stair, Regole di Scrittura,
    Modelli Narrativi e 10+1 Framework Copy (file completo per ARIA).
    """
    parts = [
        get_awareness_context(),
        get_inspirational_stair(),
        get_writing_knowledge(),
    ]
    # ARIA deve conoscere TUTTI i framework per ragionare autonomamente
    if FRAMEWORK_COPY_KNOWLEDGE:
        parts.append(f"\n{'='*60}\n10+1 FRAMEWORK COPY CHE CONVERTONO\n{'='*60}\n{FRAMEWORK_COPY_KNOWLEDGE}\n")
    return "\n".join(p for p in parts if p)

