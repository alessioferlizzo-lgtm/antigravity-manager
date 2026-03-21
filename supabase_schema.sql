-- ═══════════════════════════════════════════════════════════════
-- ANTIGRAVITY MANAGER — Supabase Schema (idempotente)
-- Può essere rieseguito più volte senza errori
-- ═══════════════════════════════════════════════════════════════

-- ── TABELLE ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_research (
    client_id   TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id          TEXT PRIMARY KEY,
    data        JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_reports (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    data        JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creative_intelligence (
    client_id   TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    data        JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_angles (
    client_id   TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    data        JSONB NOT NULL DEFAULT '[]',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_graphics_meta (
    client_id   TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    data        JSONB NOT NULL DEFAULT '[]',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_scripts (
    client_id   TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    data        JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_complete_analysis (
    client_id                TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    brand_identity           JSONB NOT NULL DEFAULT '{}',
    brand_values             JSONB NOT NULL DEFAULT '{}',
    product_portfolio        JSONB NOT NULL DEFAULT '{}',
    reasons_to_buy           JSONB NOT NULL DEFAULT '{}',
    customer_personas        JSONB NOT NULL DEFAULT '[]',
    content_matrix           JSONB NOT NULL DEFAULT '[]',
    product_vertical         JSONB NOT NULL DEFAULT '[]',
    brand_voice              JSONB NOT NULL DEFAULT '{}',
    objections               JSONB NOT NULL DEFAULT '{}',
    reviews_voc              JSONB NOT NULL DEFAULT '{}',
    battlecards              JSONB NOT NULL DEFAULT '{}',
    seasonal_roadmap         JSONB NOT NULL DEFAULT '{}',
    psychographic_analysis   JSONB NOT NULL DEFAULT '{}',
    visual_brief             JSONB NOT NULL DEFAULT '{}',
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── DISABILITA RLS (tool interno, nessuna auth multi-utente) ──────

ALTER TABLE public.clients                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_research         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reports          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_intelligence   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_angles           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_graphics_meta    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_scripts          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_complete_analysis DISABLE ROW LEVEL SECURITY;

-- ── BUCKET STORAGE ───────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
    ('logos',    'logos',    true,  10485760),
    ('raw-data', 'raw-data', false, 52428800),
    ('graphics', 'graphics', true,  20971520)
ON CONFLICT (id) DO NOTHING;

-- ── POLICY STORAGE (DROP IF EXISTS per idempotenza) ──────────────

DROP POLICY IF EXISTS "logos_all"    ON storage.objects;
DROP POLICY IF EXISTS "rawdata_all"  ON storage.objects;
DROP POLICY IF EXISTS "graphics_all" ON storage.objects;

CREATE POLICY "logos_all"    ON storage.objects FOR ALL USING (bucket_id = 'logos')    WITH CHECK (bucket_id = 'logos');
CREATE POLICY "rawdata_all"  ON storage.objects FOR ALL USING (bucket_id = 'raw-data') WITH CHECK (bucket_id = 'raw-data');
CREATE POLICY "graphics_all" ON storage.objects FOR ALL USING (bucket_id = 'graphics') WITH CHECK (bucket_id = 'graphics');
