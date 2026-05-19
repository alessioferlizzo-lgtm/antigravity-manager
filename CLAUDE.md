# Antigravity Operative Manager — Istruzioni per Claude Code

## Stack in produzione

| Layer | URL |
|---|---|
| Backend (Railway) | `https://antigravity-backend-production-41ee.up.railway.app` |
| Frontend (Vercel) | dominio sito web Antigravity |
| Database | Supabase (`tjmmmhjvbqbsglqmuipy.supabase.co`) |

Il backend locale (porta 8001) e il frontend locale (porta 3001) esistono solo per sviluppo.
**Tutto quello che gira in produzione è online** — Railway per il backend, Vercel per il frontend.

## Accesso API completo

Tutti gli endpoint del backend richiedono autenticazione per chiamate esterne.

```
Base URL:  https://antigravity-backend-production-41ee.up.railway.app
Header:    X-API-Key: a3b609cffb2d091d9097601daad7da0d78d5e56ea7bf1cb09728aea9d9a26e58
```

Questa chiave non scade mai e ha accesso completo a tutti gli endpoint (stesso livello dell'owner).

Esempio di chiamata:
```bash
curl https://antigravity-backend-production-41ee.up.railway.app/clients \
  -H "X-API-Key: a3b609cffb2d091d9097601daad7da0d78d5e56ea7bf1cb09728aea9d9a26e58"
```

## Architettura

- **Frontend**: Next.js 16.1.6 — `frontend/src/app/page.tsx` (Dashboard monolitica), `frontend/src/app/client/[id]/page.tsx`
- **Backend**: FastAPI Python — `backend/main.py` (tutti gli endpoint)
- **Storage locale**: `tasks.json`, `lists.json`, `clients/{id}/metadata.json`
- **Storage cloud**: Supabase (DB + bucket logos/graphics/raw-data)

## Design tokens

- Background: `#003366` (navy scuro)
- Accent: `#ff9e1c` (arancione), `#c7ef00` (lime)
- Stili: inline React styles + `globals.css` per hover (`.task-row`, `.task-actions`)

## Regole UX task list

- Nessuna card bianca — righe trasparenti con hover highlight
- Priorità: dot colorato 6px, non badge/pill
- Filtri tempo (Oggi/Domani/Settimana) sempre visibili come segmented control
- Task ordinati per priorità di default

## Git

- Dopo ogni modifica al codice: commit + push senza chiedere conferma.
- Il push va fatto con `git push` dal terminale dell'utente se Claude Code non ha accesso al keychain.
