-- Migration: Customer Memory Architecture (No pgvector, Pure Postgres JSONB Facts)
-- Date: 2026-09-16

-- 1. Add customer_profile JSONB to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS customer_profile JSONB DEFAULT '{"saved_uids": [], "preferred_payment": "bKash", "total_orders": 0}'::jsonb;

-- 2. Add summary and draft_state JSONB to public.conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS draft_state JSONB DEFAULT '{}'::jsonb;

-- 3. Add index on users(phone_number) and orders(delivery_phone, created_at DESC) and orders(user_id) for sub-millisecond retrieval
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_phone_recent ON public.orders(delivery_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_recent ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
