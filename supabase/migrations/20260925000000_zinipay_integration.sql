-- ============================================================================
-- DS DUKAN: ZINIPAY AUTOMATIC PAYMENT GATEWAY INTEGRATION
-- Adds invoice_id column to orders and payments tables
-- Registers zinipay_auto_payment system setting
-- ============================================================================

-- 1. Add invoice_id and payment_url to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON public.orders(invoice_id);

-- 2. Add invoice_id to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);

-- 3. Register default system settings for ZiniPay Gateway
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('zinipay_auto_payment', 'true'::jsonb, 'Automatic payment link creation and instant verification via ZiniPay API')
ON CONFLICT (key) DO NOTHING;
