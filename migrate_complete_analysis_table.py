#!/usr/bin/env python3
"""
Script per creare la tabella client_complete_analysis in Supabase.
Esegue le query SQL per aggiungere la nuova tabella al database.
"""

import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Serve la service key per DDL

async def migrate():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("🔄 Creazione tabella client_complete_analysis...")

    # Leggi lo schema SQL
    with open("supabase_schema.sql", "r") as f:
        schema_sql = f.read()

    # Estrai solo la parte relativa alla nuova tabella
    create_table_sql = """
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
"""

    try:
        # Supabase Python client non supporta direttamente SQL DDL
        # Dobbiamo usare l'API REST o la dashboard Supabase
        print("⚠️  NOTA: La creazione della tabella deve essere fatta manualmente nella dashboard Supabase")
        print("    oppure eseguendo direttamente lo script SQL in supabase_schema.sql")
        print("\n📋 SQL da eseguire:")
        print(create_table_sql)
        print("\n✅ Vai su: https://supabase.com/dashboard/project/.../editor/sql")
        print("   Copia e incolla lo script sopra")

        # Verifica se la tabella esiste
        try:
            result = await supabase.table("client_complete_analysis").select("client_id").limit(1).execute()
            print("\n✅ Tabella client_complete_analysis già esistente e accessibile!")
        except Exception as e:
            print(f"\n⚠️  Tabella non ancora creata. Errore: {e}")
            print("   Esegui manualmente lo script SQL sopra nella dashboard Supabase.")

    except Exception as e:
        print(f"❌ Errore: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
