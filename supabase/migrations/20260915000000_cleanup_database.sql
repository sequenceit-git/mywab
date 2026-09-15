-- Migration: 20260915000000_cleanup_database.sql
-- Description: Drop unused tables (products, policies, ai_policies) and clean up foreign keys

-- 1. Drop foreign key from order_items to products if exists
ALTER TABLE IF EXISTS public.order_items 
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

-- 2. Drop unused tables and their policies
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.policies CASCADE;
DROP TABLE IF EXISTS public.ai_policies CASCADE;

-- 3. Ensure proper indexes for the active tables
CREATE INDEX IF NOT EXISTS idx_orders_delivery_phone ON public.orders(delivery_phone);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_trx ON public.payments(trx_id);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON public.faqs(category);
