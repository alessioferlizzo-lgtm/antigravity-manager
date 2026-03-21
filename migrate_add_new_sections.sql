-- ═══════════════════════════════════════════════════════════════
-- MIGRAZIONE: Aggiungi Sezioni 13 e 14 all'Analisi Completa
-- Da eseguire UNA VOLTA in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Aggiungi colonne per Analisi Psicografica (sezione 13) e Visual Brief (sezione 14)
ALTER TABLE public.client_complete_analysis
ADD COLUMN IF NOT EXISTS psychographic_analysis JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS visual_brief JSONB NOT NULL DEFAULT '{}';
