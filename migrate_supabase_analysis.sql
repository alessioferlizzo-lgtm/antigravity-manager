-- Migrazione: Aggiunta tabella client_complete_analysis
-- Eseguire questo script nella dashboard Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.client_complete_analysis (
    client_id             TEXT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    brand_identity        JSONB NOT NULL DEFAULT '{}',
    brand_values          JSONB NOT NULL DEFAULT '{}',
    product_portfolio     JSONB NOT NULL DEFAULT '{}',
    reasons_to_buy        JSONB NOT NULL DEFAULT '{}',
    customer_personas     JSONB NOT NULL DEFAULT '[]',
    content_matrix        JSONB NOT NULL DEFAULT '[]',
    product_vertical      JSONB NOT NULL DEFAULT '[]',
    brand_voice           JSONB NOT NULL DEFAULT '{}',
    objections            JSONB NOT NULL DEFAULT '{}',
    reviews_voc           JSONB NOT NULL DEFAULT '{}',
    battlecards           JSONB NOT NULL DEFAULT '{}',
    seasonal_roadmap      JSONB NOT NULL DEFAULT '{}',
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_complete_analysis DISABLE ROW LEVEL SECURITY;
