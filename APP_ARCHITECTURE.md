# 🏗️ ANTIGRAVITY MANAGER — Architettura e Logica

## 📋 COSA FA L'APP

**Antigravity Manager** è una piattaforma di **Marketing Intelligence & Brand Analysis** che genera automaticamente analisi strategiche complete per clienti usando AI multiple (Claude, Perplexity, Gemini).

### Flusso Principale:
1. **Aggiungi Cliente** → Inserisci nome, sito, Instagram, Meta Ads Account
2. **Configura Sorgenti** → Carica documenti, competitor, link esterni
3. **Genera Analisi Strategica** → AI analizza tutto e genera 14 sezioni
4. **Usa i Dati** → Buyer personas, battlecards, roadmap, copy angles

---

## 🧠 LOGICA DELL'APP

### Stack Tecnologico:
- **Frontend**: Next.js 16 + React 19 + TailwindCSS (deploy su Vercel)
- **Backend**: Python FastAPI + Async (deploy su Railway/altro)
- **Database**: Supabase PostgreSQL (JSONB per flessibilità)
- **AI**: OpenRouter (Claude 3.7 Sonnet, Perplexity Sonar Pro)
- **Integrazioni**: Meta Graph API (Instagram + Ads), Fal.ai (immagini), Notion (legacy)

### Architettura:

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Scheda Cliente (/client/[id])                        │   │
│  │  ├─ 📍 Sorgenti (config)                             │   │
│  │  ├─ 🎨 Identità (brand identity manuale)             │   │
│  │  ├─ 📊 Analisi Strategica (14 sezioni AI)           │   │
│  │  ├─ 👤 Buyer Personas (edit + genera specifiche)     │   │
│  │  └─ 📈 Reports (KPI + Creative Intelligence)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼ HTTP API
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ main.py — 3600+ righe                                 │   │
│  │  ├─ CRUD Clienti                                      │   │
│  │  ├─ Upload Files (PDF, immagini)                      │   │
│  │  ├─ Meta API (Instagram posts, Ads insights)          │   │
│  │  ├─ Analisi Strategica (POST /analysis/complete)      │   │
│  │  ├─ Reports (KPI manuali + AI analysis)               │   │
│  │  ├─ Generazione Copy, Angoli, Script, Graphics        │   │
│  │  └─ Export PDF/HTML                                   │   │
│  │                                                        │   │
│  │ ai_service.py — Orchestrazione AI                     │   │
│  │  ├─ _call_ai() → OpenRouter                           │   │
│  │  ├─ Modelli: claude-3.7-sonnet, perplexity/sonar-pro │   │
│  │  └─ JSON repair automatico                            │   │
│  │                                                        │   │
│  │ ai_service_complete_analysis*.py (part 1-4)           │   │
│  │  ├─ 14 funzioni AI (1 per sezione)                    │   │
│  │  ├─ Prompt dalla guida metodologica                   │   │
│  │  └─ Orchestrator che chiama tutto in sequenza         │   │
│  │                                                        │   │
│  │ storage_service.py — File system (legacy)             │   │
│  │ notion_service.py — Sync Notion (legacy)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (PostgreSQL)                      │
│  ├─ clients (metadata JSONB)                                 │
│  ├─ client_complete_analysis (14 colonne JSONB)              │
│  ├─ client_reports (KPI + AI analysis)                       │
│  ├─ client_angles (angoli comunicazione)                     │
│  ├─ client_scripts (script video)                            │
│  ├─ client_graphics_meta (metadata grafiche)                 │
│  └─ Storage Buckets (logos, raw-data, graphics)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 FUNZIONALITÀ CHIAVE

### 1. **Analisi Strategica (Core Feature)**
**Endpoint**: `POST /clients/{id}/analysis/complete`

**Cosa fa**:
1. Raccoglie dati da Instagram (Meta Graph API)
2. Raccoglie performance Meta Ads (CTR, CPC, best ads)
3. Legge documenti caricati (PDF, cataloghi)
4. Chiama 14 funzioni AI in sequenza
5. Salva tutto in Supabase

**14 Sezioni Generate**:
```
🏢 BRAND & POSIZIONAMENTO
├─ 1. Brand Identity & Posizionamento (Perplexity)
├─ 2. Valori del Brand (Claude)
└─ 8. Brand Voice & Guidelines (Claude)

🛍️ PRODOTTI & MERCATO
├─ 3. Portafoglio Prodotti (Perplexity)
├─ 7. Analisi Verticale Prodotti (Claude)
├─ 4. Reasons to Buy (Claude)
└─ 9. Gestione Obiezioni (Claude)

👥 PERSONAS & STRATEGIA CONTENUTI
├─ 5. Customer Personas (10 ICP) (Perplexity)
├─ 13. Analisi Psicografica (3 livelli) (Claude)
├─ 6. Matrice Strategia Contenuti (Claude)
└─ 10. Voice of Customer (Claude)

⚔️ COMPETITIVE INTELLIGENCE
├─ 11. Competitor Battlecards (Perplexity)
├─ 12. Roadmap Stagionale (Claude)
└─ 14. Visual Brief (Claude)
```

**Tempo**: 10-15 minuti (14 chiamate AI sequenziali)

### 2. **Meta API Integration**
- Instagram Business Discovery (posts, engagement, commenti)
- Meta Ads Insights (CTR, CPC, CPA, best performing ads)
- Usa `meta_access_token` configurato per cliente

### 3. **Generazione Copy & Creatività**
- **Angoli Comunicazione**: Genera hook/angles strategici
- **Script Video**: Script TikTok/Reels con timing
- **Copy Ads**: Variazioni copy Meta Ads (PAS, AIDA, BAB)
- **Grafiche**: Genera immagini con Fal.ai

### 4. **Reports & KPI**
- Input manuale KPI (spend, ROAS, conversioni)
- AI analizza performance e suggerisce ottimizzazioni
- Creative Intelligence: analizza ads reali e trova pattern

---

## 📁 STRUTTURA FILE

### Backend (Python)
```
backend/
├── main.py                                  # API principale (3600 righe)
├── ai_service.py                            # Orchestrazione AI calls
├── ai_service_complete_analysis.py          # Sezioni 1-5
├── ai_service_complete_analysis_part2.py    # Sezioni 6-10
├── ai_service_complete_analysis_part3.py    # Sezioni 11-12
├── ai_service_complete_analysis_part4.py    # Sezioni 13-14
├── storage_service.py                       # File system (legacy)
├── notion_service.py                        # Sync Notion (legacy)
└── (altri file deprecati — vedi sotto)
```

### Frontend (Next.js)
```
frontend/src/
├── app/
│   └── client/[id]/page.tsx                 # Scheda cliente (2100 righe)
└── components/
    ├── AnalisiStrategicaSection.tsx         # UI Analisi Strategica ✅ ATTIVA
    └── CompleteAnalysisSection.tsx          # ❌ DEPRECATA (sostituita)
```

### Database
```
supabase_schema.sql                          # Schema principale ✅
migrate_add_new_sections.sql                # Migrazione sezioni 13-14 ✅
migrate_supabase_analysis.sql               # ❌ DEPRECATA (vecchia)
```

### Docs
```
DEPLOY_COMPLETATO.md                         # ✅ Istruzioni deploy attuali
IMPLEMENTAZIONE_COMPLETATA.md               # ⚠️ Parzialmente obsoleto
ANALISI_COMPLETA_IMPLEMENTATION.md          # ⚠️ Parzialmente obsoleto
```

---

## 🗑️ FILE DA ELIMINARE

### Root Directory (test e migration obsoleti)
```bash
rm test_openrouter.py                        # Test API vecchio
rm test_notion.py                            # Test Notion (legacy)
rm test_sync.py                              # Test sync Notion (legacy)
rm test_complete_analysis.py                 # Test vecchio (12 sezioni)
rm migrate_to_supabase.py                    # Migrazione già fatta
rm verify_supabase_migration.py              # Verifica già fatta
rm migrate_complete_analysis_table.py        # Migrazione già fatta
rm migrate_supabase_analysis.sql             # Migrazione vecchia
rm inspect_notion_schema_copy_angles.py      # Inspection vecchia
rm list_models.py                            # Lista modelli OpenRouter
rm run_app.py                                # Script run locale (non serve)
rm GEMINI.md                                 # Doc su Gemini (non usato)
rm ANALISI_COMPLETA_IMPLEMENTATION.md        # Doc parzialmente obsoleta
rm IMPLEMENTAZIONE_COMPLETATA.md             # Doc parzialmente obsoleta
```

### Backend (file Notion e inspection deprecati)
```bash
rm backend/create_notion_architecture.py
rm backend/inspect_notion.py
rm backend/inspect_notion_2.py
rm backend/inspect_graphics_vault.py
rm backend/repair_notion_graphics.py
rm backend/repair_notion_public.py
rm backend/sync_clients.py
rm backend/migrate_graphics.py
```

### Frontend (componente sostituito)
```bash
rm frontend/src/components/CompleteAnalysisSection.tsx
rm frontend/src/app/client/[id]/page.tsx.backup
```

### Temporanei
```bash
rm -rf .tmp/
```

---

## ✅ FILE DA MANTENERE

### Essenziali per funzionamento:
- ✅ **supabase_schema.sql** — Schema database completo
- ✅ **migrate_add_new_sections.sql** — Ultima migrazione (sezioni 13-14)
- ✅ **DEPLOY_COMPLETATO.md** — Istruzioni deploy
- ✅ **backend/main.py** — API principale
- ✅ **backend/ai_service*.py** — Tutti i 5 file AI
- ✅ **backend/storage_service.py** — Gestione file (ancora usata)
- ✅ **backend/notion_service.py** — Sync Notion (ancora usata?)
- ✅ **frontend/src/components/AnalisiStrategicaSection.tsx** — UI attiva
- ✅ **frontend/src/app/client/[id]/page.tsx** — Pagina principale
- ✅ **tasks.json** — Task persistenza (usata?)

---

## 🔄 FLUSSI CHIAVE

### Flusso "Genera Analisi Strategica"
```
1. User clicca "Genera Analisi Strategica"
   ↓
2. Frontend → POST /clients/{id}/analysis/complete
   ↓
3. Backend raccoglie dati:
   - Instagram posts/comments via Meta API
   - Meta Ads insights (CTR, CPC, top ads)
   - Documenti caricati (PDF → testo)
   ↓
4. Backend chiama orchestrator:
   generate_complete_analysis_orchestrator()
   ↓
5. Orchestrator chiama 14 funzioni AI in sequenza:
   - Ogni funzione usa prompt specifico dalla guida
   - Perplexity per ricerca web (brand identity, personas, competitors)
   - Claude per analisi psicologica e copywriting
   ↓
6. Backend salva in Supabase:
   INSERT INTO client_complete_analysis (14 colonne JSONB)
   ↓
7. Frontend riceve risposta e mostra 4 macro-aree accordion
```

### Flusso "Meta Ads Insights"
```
1. Backend legge ad_account_id e meta_access_token da metadata
2. Chiama Meta Graph API:
   GET /{ad_account_id}/insights?fields=...
3. Filtra top 40 ads per spend
4. Per ogni ad, fetch creative details:
   GET /{ad_id}?fields=creative{body,title,image_url}
5. Ritorna array con performance + copy + immagini
```

---

## 🎯 PROSSIMI STEP CONSIGLIATI

1. ✅ **Eliminare file obsoleti** (vedi lista sopra)
2. ⚠️ **Valutare se eliminare Notion integration** (se non più usata)
3. 📝 **Creare doc unica e pulita** (sostituire le 3 vecchie)
4. 🧪 **Aggiungere test E2E** per Analisi Strategica
5. 📊 **Export PDF completo** (attualmente export è HTML base)

---

Generato: 2026-03-21
