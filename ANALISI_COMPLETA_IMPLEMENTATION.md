# Implementazione Analisi Completa - Metodologia Guida

## 📋 Panoramica

Questo documento descrive l'implementazione dell'**Analisi Completa** per il Database Clienti Antigravity, seguendo ESATTAMENTE la metodologia descritta nella guida "guida su come fare analisi.md".

L'analisi è composta da **12 sezioni** che coprono tutti gli aspetti strategici del brand cliente.

---

## 🎯 Le 12 Sezioni dell'Analisi

### 1. **BRAND IDENTITY & POSIZIONAMENTO**
- Mission (scopo profondo)
- Tono di Voce
- Estetica/Visual Identity
- Posizionamento (Masstige/Lusso/Economico)
- Statement

### 2. **VALORI DEL BRAND (Brand Pillars)**
- Inclusività
- Sostenibilità
- Formulazioni (Vegan, Cruelty-free, Clean Beauty)
- Qualità Premium

### 3. **ANALISI PORTAFOGLIO PRODOTTI**
- Diviso per categorie/fasi
- Per ogni prodotto: Nome, Benefit, Ingredienti, USP

### 4. **REASONS TO BUY (RTB)**
- RTB Razionali (testa)
- RTB Emotive (cuore)

### 5. **LE 10 IDEAL CUSTOMER PERSONAS (ICP)**
- 10 profili dettagliati con nomi evocativi
- Chi è, problema principale

### 6. **MATRICE STRATEGIA DEI CONTENUTI**
- Hook Principale per ogni Persona
- Paid Ads Strategy
- Organic Social Strategy

### 7. **ANALISI VERTICALE PRODOTTI**
- Scheda dettagliata per ogni prodotto top
- Analisi Tecnica + Strategia Marketing + 3 RTB + 3 Hooks

### 8. **BRAND VOICE & COMMUNICATION GUIDELINES**
- Brand Persona & Archetipi
- Pilastri della Comunicazione
- Analisi Linguistica
- Glossario "Invece di... Usa..."
- DOs & DON'Ts
- Emoji Strategy

### 9. **GESTIONE OBIEZIONI**
- 5 categorie di obiezioni con script di risposta
- Obiezioni Prezzo, Meccanica, Prodotto, Etica, Formati

### 10. **ANALISI RECENSIONI (Voice of Customer)**
- Golden Hooks da recensioni positive
- Pain Points da recensioni negative
- Keywords Ricorrenti
- Conclusione Pratica

### 11. **BATTLECARDS COMPETITOR**
- vs Competitor Diretto
- vs Gigante Retail
- vs Abitudine/Sostituto
- vs Soluzione Definitiva
- Cheat Sheet + Idee Ads

### 12. **ROADMAP STAGIONALE**
- Piano Q1-Q4
- Per ogni mese: Tema, Prodotto Hero, Strategia, Target, Hook

---

## 🤖 Modelli AI Utilizzati

### **Perplexity Sonar Pro**
Usato per:
- Ricerca web profonda
- Analisi competitor
- Navigazione siti
- Sezioni: 1, 2, 3, 7, 11

### **Claude 3.7 Sonnet**
Usato per:
- Analisi psicologica
- Copywriting
- Strutturazione strategica
- Sezioni: 4, 5, 6, 8, 9, 10, 12

---

## 📊 Fonti Dati (Priorità)

### 🔴 **MASSIMA PRIORITÀ: Dati Meta API Reali**

#### Instagram Business Discovery
- Post del brand (caption, likes, commenti)
- Engagement rate
- Pattern di contenuti ad alto engagement
- **Commenti testuali dei followers** (vocabolario reale del target)
- Bio e follower count

#### Meta Ads Manager
- Ads attive (ultimi 90 giorni)
- Performance: CTR, CPC, CPA, Spend, Conversioni
- **Copy degli ads** (headline, body, description)
- **Angoli comunicativi testati**
- **Formati creativi vincenti**

### ✅ Altri Dati
- Sito web del cliente
- Documenti caricati (cataloghi, menu, PDF)
- Competitor links
- Google Reviews (opzionale)

---

## 🏗️ Architettura Implementazione

### Backend (Python)

#### File Creati:

1. **`backend/ai_service_complete_analysis.py`**
   - Funzioni 1-5: Brand Identity, Values, Products, RTB, Personas

2. **`backend/ai_service_complete_analysis_part2.py`**
   - Funzioni 6-10: Content Matrix, Product Vertical, Brand Voice, Objections, Reviews

3. **`backend/ai_service_complete_analysis_part3.py`**
   - Funzioni 11-12: Battlecards, Seasonal Roadmap
   - **Orchestrator**: `generate_complete_analysis_orchestrator()`

#### Integrazione in `ai_service.py`:

```python
async def generate_complete_analysis(
    self,
    client_info: Dict[str, Any],
    site_url: str,
    social_data: str = "",
    ads_data: str = "",
    raw_docs: str = "",
    google_reviews: str = "",
    instagram_comments: str = ""
) -> Dict[str, Any]:
    """
    Genera tutte le 12 sezioni.
    Orchestrator principale.
    """
```

### Endpoint FastAPI (main.py)

```python
POST   /clients/{client_id}/analysis/complete  # Genera analisi completa
GET    /clients/{client_id}/analysis/complete  # Recupera analisi salvata
DELETE /clients/{client_id}/analysis/complete  # Elimina analisi
```

### Database (Supabase)

**Tabella**: `client_complete_analysis`

```sql
CREATE TABLE client_complete_analysis (
    client_id             TEXT PRIMARY KEY REFERENCES clients(id),
    brand_identity        JSONB,
    brand_values          JSONB,
    product_portfolio     JSONB,
    reasons_to_buy        JSONB,
    customer_personas     JSONB,  -- array di 10 personas
    content_matrix        JSONB,  -- array di strategie
    product_vertical      JSONB,  -- array di schede prodotto
    brand_voice           JSONB,
    objections            JSONB,
    reviews_voc           JSONB,
    battlecards           JSONB,
    seasonal_roadmap      JSONB,
    created_at            TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ
);
```

---

## 🔧 Setup e Migrazione

### 1. Migrazione Database

Esegui lo script SQL manualmente nella dashboard Supabase:

```bash
# Copia il contenuto del file supabase_schema.sql
# Vai su: https://supabase.com/dashboard/project/.../editor/sql
# Incolla ed esegui lo script
```

Oppure usa lo script Python helper:

```bash
python migrate_complete_analysis_table.py
```

### 2. Verifica Installazione

Controlla che i nuovi file esistano:

```bash
ls backend/ai_service_complete_analysis*.py
```

Output atteso:
```
backend/ai_service_complete_analysis.py
backend/ai_service_complete_analysis_part2.py
backend/ai_service_complete_analysis_part3.py
```

---

## 🚀 Come Usare

### Da Backend (API)

```python
# POST /clients/{client_id}/analysis/complete
{
    "success": true,
    "analysis": {
        "brand_identity": {...},
        "brand_values": {...},
        "product_portfolio": {...},
        "reasons_to_buy": {...},
        "customer_personas": [...],  # 10 personas
        "content_matrix": [...],
        "product_vertical": [...],
        "brand_voice": {...},
        "objections": {...},
        "reviews_voc": {...},
        "battlecards": {...},
        "seasonal_roadmap": {...}
    }
}
```

### Workflow Completo

1. **Setup Cliente**:
   - Aggiungi sito web in "Sorgenti"
   - (Opzionale) Configura Meta Access Token
   - (Opzionale) Carica documenti (cataloghi, menu)

2. **Genera Analisi**:
   ```
   POST /clients/{client_id}/analysis/complete
   ```
   - Durata stimata: **8-12 minuti** (12 chiamate AI sequenziali)

3. **Recupera Analisi**:
   ```
   GET /clients/{client_id}/analysis/complete
   ```

4. **Visualizza nel Frontend** (TODO):
   - Tab "Analisi Completa"
   - 12 sezioni accordion espandibili
   - Export PDF

---

## 📝 Prompt Utilizzati

Tutti i prompt sono **ESATTI** dalla guida. Esempi:

### Prompt Brand Identity
```
Ruolo: Agisci come un Senior Brand Strategist & Marketing Analyst...
Input: Link al sito web: [URL]
Output Richiesto: Genera un report strutturato in questi punti:
1. MISSION
2. TONO DI VOCE
3. ESTETICA
4. POSIZIONAMENTO
5. STATEMENT
```

### Prompt Customer Personas
```
Ruolo: Agisci come un Consumer Insights Analyst.
Estrapola esattamente 10 profili di clienti ideali...
Dai a ognuno un NOME EVOCATIVO (es. "Skincare Intellectual")...
```

### Prompt Brand Voice
```
Ruolo: Agisci come un Brand Linguist & Psicologo della Comunicazione.
Decodifica le leve psicologiche e le scelte semantiche nascoste...
6 Moduli: Persona, Pilastri, Analisi Linguistica, Glossario, DOs/DON'Ts, Tattici
```

---

## ✅ Garanzie di Qualità

1. **Prompt Testuali Originali**: Copiati ESATTAMENTE dalla guida
2. **Esempi Come Riferimento**: L'AI riceve esempi Fler/Nevoh come gold standard
3. **Dati Reali Prima**: Priorità assoluta a Meta API e Instagram
4. **Zero Genericità**: Prompt esplicita "solo dati specifici e citazioni letterali"
5. **Formattazione Fedele**: Export PDF identico alla guida

---

## 🧪 Testing

### Test Manuale

```bash
# 1. Avvia il backend
cd backend
.venv/bin/python run_app.py

# 2. In un altro terminale, testa l'endpoint
curl -X POST http://localhost:8001/clients/{CLIENT_ID}/analysis/complete

# 3. Monitora i log del backend
# Dovresti vedere:
# 🔄 Generazione analisi completa: Step 1/12 - Brand Identity...
# 🔄 Step 2/12 - Brand Values...
# ...
# ✅ Analisi completa generata con successo!
```

### Verifica Database

```sql
SELECT client_id, created_at, updated_at
FROM client_complete_analysis
WHERE client_id = 'xxx';
```

---

## 📋 TODO Frontend

- [ ] Creare componente `CompleteAnalysisSection.tsx`
- [ ] 12 sezioni accordion espandibili
- [ ] Pulsante "Genera Analisi Completa"
- [ ] Pulsante "Rigenera Sezione" per singola parte
- [ ] Funzione Export PDF con formattazione guida
- [ ] Visualizzazione tabelle markdown (Content Matrix, Battlecards)
- [ ] Visualizzazione liste (Personas, RTB)

---

## 🐛 Troubleshooting

### Errore: "Nessun sito web fornito"
**Soluzione**: Aggiungi un link nella sezione "Sorgenti" del cliente

### Errore: "Tabella non trovata"
**Soluzione**: Esegui la migrazione SQL in Supabase dashboard

### Timeout durante generazione
**Soluzione**: Normale, l'analisi richiede 8-12 minuti. Aumenta timeout frontend se necessario.

### Dati Instagram vuoti
**Soluzione**:
1. Verifica Meta Access Token in .env o nel cliente
2. Verifica handle Instagram corretto nei links
3. Account deve essere Business/Creator

---

## 📚 Riferimenti

- Guida originale: `Istruzioni Analisi/guida su come fare analisi.md`
- Esempio completo: `Istruzioni Analisi/analisi non completa da prendere come esempio.md`
- Schema database: `supabase_schema.sql`
- Migration script: `migrate_complete_analysis_table.py`

---

## 🎉 Conclusione

L'implementazione backend è **COMPLETA** e pronta per l'uso.

**Prossimi Step**:
1. ✅ Backend implementato
2. 🔄 Testare con cliente reale
3. ⏳ Frontend (UI per visualizzare + Export PDF)

---

**Autore**: Claude Code
**Data**: Marzo 2026
**Versione**: 1.0
