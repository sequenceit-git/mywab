-- Migration: 20260923000000_game_packages_table.sql
-- Description: Dynamic Game Packages Table for Admin Management and Live Bot Sync

CREATE TABLE IF NOT EXISTS public.game_packages (
    id VARCHAR(100) PRIMARY KEY,
    category_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-performance category lookups by WhatsApp bot
CREATE INDEX IF NOT EXISTS idx_game_packages_cat ON public.game_packages(category_id);
CREATE INDEX IF NOT EXISTS idx_game_packages_active ON public.game_packages(category_id, is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.game_packages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read for game_packages' AND tablename = 'game_packages') THEN
        CREATE POLICY "Public read for game_packages" ON public.game_packages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin all for game_packages' AND tablename = 'game_packages') THEN
        CREATE POLICY "Admin all for game_packages" ON public.game_packages FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
