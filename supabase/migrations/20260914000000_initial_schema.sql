-- Migration: 20260914000000_initial_schema.sql
-- Description: Initial schema for WapBusiness including tables, indexes, RLS policies, and atomic stored procedures.

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS (Customers)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(255),
    address_profile JSONB DEFAULT '{}'::jsonb,
    language_pref VARCHAR(10) DEFAULT 'bn', -- 'bn' or 'en'
    status_tag VARCHAR(50) DEFAULT 'REGULAR', -- 'VIP', 'REGULAR', 'FLAGGED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel VARCHAR(30) DEFAULT 'WHATSAPP',
    is_ai_active BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL, -- 'CUSTOMER', 'BOT', 'ADMIN'
    content TEXT NOT NULL,
    media_url TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_bn TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    stock_qty INT NOT NULL DEFAULT 0,
    category VARCHAR(100) DEFAULT 'General',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. FAQS
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_en TEXT NOT NULL,
    question_bn TEXT NOT NULL,
    answer_en TEXT NOT NULL,
    answer_bn TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. WAP-20260914-1001
    user_id UUID NOT NULL REFERENCES public.users(id),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CLAIM', 
    -- PENDING_PAYMENT, PENDING_CLAIM, CLAIMED, PROCESSING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
    delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_phone VARCHAR(30) NOT NULL,
    customer_notes TEXT,
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name VARCHAR(255) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. WORKERS (Telegram Staff)
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(30),
    role VARCHAR(30) DEFAULT 'WORKER', -- 'WORKER', 'SUPERVISOR', 'ADMIN'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ORDER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.order_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id),
    status VARCHAR(30) DEFAULT 'CLAIMED', -- 'CLAIMED', 'PROCESSING', 'DELIVERED', 'RELEASED'
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT
);

-- 11. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'COD', -- 'COD', 'BKASH', 'NAGAD', 'CARD'
    trx_id VARCHAR(100),
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'UNPAID', -- 'UNPAID', 'VERIFYING', 'VERIFIED', 'FAILED'
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ATOMIC ORDER CLAIM STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.claim_order_atomic(
    p_order_id_code VARCHAR,
    p_telegram_user_id BIGINT,
    p_worker_name VARCHAR,
    p_telegram_username VARCHAR DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record public.orders%ROWTYPE;
    v_worker_id UUID;
    v_assignment_id UUID;
BEGIN
    -- 1. Ensure worker exists or register/update worker
    INSERT INTO public.workers (telegram_user_id, telegram_username, full_name)
    VALUES (p_telegram_user_id, p_telegram_username, p_worker_name)
    ON CONFLICT (telegram_user_id) 
    DO UPDATE SET 
        telegram_username = COALESCE(NULLIF(EXCLUDED.telegram_username, ''), public.workers.telegram_username),
        full_name = EXCLUDED.full_name
    RETURNING id INTO v_worker_id;

    -- 2. Lock the order row exclusively for update
    SELECT * INTO v_order_record
    FROM public.orders
    WHERE order_id = p_order_id_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found', 'code', 'ORDER_NOT_FOUND');
    END IF;

    -- 3. Check if already claimed
    IF v_order_record.status != 'PENDING_CLAIM' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Order already claimed or in progress by another worker', 
            'current_status', v_order_record.status,
            'code', 'ALREADY_CLAIMED'
        );
    END IF;

    -- 4. Update order status to CLAIMED
    UPDATE public.orders
    SET status = 'CLAIMED', updated_at = NOW()
    WHERE id = v_order_record.id;

    -- 5. Record assignment
    INSERT INTO public.order_assignments (order_id, worker_id, status, claimed_at)
    VALUES (v_order_record.id, v_worker_id, 'CLAIMED', NOW())
    RETURNING id INTO v_assignment_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order successfully claimed',
        'order_id', v_order_record.id,
        'order_code', v_order_record.order_id,
        'worker_id', v_worker_id,
        'worker_name', p_worker_name,
        'assignment_id', v_assignment_id
    );
END;
$$;

-- 13. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workers_telegram ON public.workers(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON public.order_assignments(order_id);

-- 14. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow anon & service_role full access for web app & bot operations
DO $$ 
BEGIN
    -- Products & FAQs (Public read, service_role/authenticated write)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public products read' AND tablename = 'products') THEN
        CREATE POLICY "Public products read" ON public.products FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public products insert/update' AND tablename = 'products') THEN
        CREATE POLICY "Public products insert/update" ON public.products FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public faqs read' AND tablename = 'faqs') THEN
        CREATE POLICY "Public faqs read" ON public.faqs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public faqs write' AND tablename = 'faqs') THEN
        CREATE POLICY "Public faqs write" ON public.faqs FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Users
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users access' AND tablename = 'users') THEN
        CREATE POLICY "Users access" ON public.users FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Conversations & Messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Conversations access' AND tablename = 'conversations') THEN
        CREATE POLICY "Conversations access" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Messages access' AND tablename = 'messages') THEN
        CREATE POLICY "Messages access" ON public.messages FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Orders & Order Items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Orders access' AND tablename = 'orders') THEN
        CREATE POLICY "Orders access" ON public.orders FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Order items access' AND tablename = 'order_items') THEN
        CREATE POLICY "Order items access" ON public.order_items FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Workers & Assignments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Workers access' AND tablename = 'workers') THEN
        CREATE POLICY "Workers access" ON public.workers FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Assignments access' AND tablename = 'order_assignments') THEN
        CREATE POLICY "Assignments access" ON public.order_assignments FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Payments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Payments access' AND tablename = 'payments') THEN
        CREATE POLICY "Payments access" ON public.payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
