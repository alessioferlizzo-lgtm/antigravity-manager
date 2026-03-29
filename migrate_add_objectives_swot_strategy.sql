-- ============================================================
-- Migration: Aggiungi colonne objectives, swot, strategy
-- alla tabella client_complete_analysis
-- ============================================================

-- Aggiungi colonna objectives (se non esiste)
ALTER TABLE client_complete_analysis 
    ADD COLUMN IF NOT EXISTS objectives JSONB DEFAULT '{}';

-- Aggiungi colonna swot (se non esiste)
ALTER TABLE client_complete_analysis 
    ADD COLUMN IF NOT EXISTS swot JSONB DEFAULT '{}';

-- Aggiungi colonna strategy (se non esiste)
ALTER TABLE client_complete_analysis 
    ADD COLUMN IF NOT EXISTS strategy TEXT DEFAULT '';

-- Aggiungi colonna updated_at (se non esiste)
ALTER TABLE client_complete_analysis 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_complete_analysis_updated_at ON client_complete_analysis;
CREATE TRIGGER update_client_complete_analysis_updated_at
    BEFORE UPDATE ON client_complete_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
