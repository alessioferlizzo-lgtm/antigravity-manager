-- Crea tabella smart_lists su Supabase
CREATE TABLE IF NOT EXISTS smart_lists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    is_smart BOOLEAN DEFAULT TRUE,
    criteria JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Abilita RLS (Row Level Security)
ALTER TABLE smart_lists ENABLE ROW LEVEL SECURITY;

-- Policy per permettere lettura a tutti
CREATE POLICY "Enable read access for all users" ON smart_lists
    FOR SELECT USING (true);

-- Policy per permettere insert/update/delete a tutti (puoi restringere in futuro)
CREATE POLICY "Enable insert for all users" ON smart_lists
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON smart_lists
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON smart_lists
    FOR DELETE USING (true);
