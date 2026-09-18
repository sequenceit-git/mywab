-- Migration: 20260918000000_database_cleanup_final.sql
-- Description: Drop any unused legacy tables/columns and ensure all active working tables and indexes are finalized

-- 1. Ensure package_pricing table exists
CREATE TABLE IF NOT EXISTS public.package_pricing (
    id VARCHAR(100) PRIMARY KEY,
    price NUMERIC(10, 2) NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Alter order_items product_id to VARCHAR(100) to support package IDs like 'pkg_pubg_60'
ALTER TABLE public.order_items ALTER COLUMN product_id TYPE VARCHAR(100);

-- 3. Ensure updated_at column exists on conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Enable RLS on package_pricing
ALTER TABLE public.package_pricing ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Package pricing access' AND tablename = 'package_pricing') THEN
        CREATE POLICY "Package pricing access" ON public.package_pricing FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. Drop any legacy unused tables if they exist
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.policies CASCADE;
DROP TABLE IF EXISTS public.ai_policies CASCADE;

-- 6. Ensure optimal indexes on active tables
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_phone_recent ON public.orders(delivery_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_recent ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workers_telegram ON public.workers(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON public.order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_trx ON public.payments(trx_id);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON public.faqs(category);
