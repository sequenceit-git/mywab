-- ============================================================================
-- DS DUKAN: SYSTEM SETTINGS TABLE (KOKOS AUTO-FULFILLMENT & RUNTIME CONFIGS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('kokos_pubg_auto_fulfill', 'false'::jsonb, 'Automatic PUBG Mobile UID redemption via Kokos Activator API'),
  ('kokos_fallback_to_telegram', 'true'::jsonb, 'Fallback to Telegram worker bot if Kokos auto-fulfillment fails')
ON CONFLICT (key) DO NOTHING;

-- RLS Policies
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to system_settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow admin write access to system_settings"
  ON public.system_settings FOR ALL
  USING (true);
