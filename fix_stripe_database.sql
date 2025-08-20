-- Fix Stripe integration: Add missing columns
-- Execute this in Supabase SQL Editor or as migration

-- 1. Add missing columns to pedidos table
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- 2. Add missing column to payment_logs table  
ALTER TABLE payment_logs
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pedidos_stripe_checkout_session 
ON pedidos(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_stripe_payment_intent 
ON pedidos(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payment_logs_stripe_checkout_session 
ON payment_logs(stripe_checkout_session_id);

-- 4. Verify the changes
SELECT 'pedidos columns check' as table_check, 
       COUNT(*) as stripe_columns_count 
FROM information_schema.columns 
WHERE table_name = 'pedidos' 
  AND column_name IN ('stripe_checkout_session_id', 'stripe_payment_intent_id');

SELECT 'payment_logs columns check' as table_check,
       COUNT(*) as stripe_columns_count
FROM information_schema.columns 
WHERE table_name = 'payment_logs' 
  AND column_name = 'stripe_checkout_session_id';