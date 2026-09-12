-- =============================================================================
-- E-COMMERCE — Índice único de sesión de Stripe Checkout
-- Forward-only: solo ejecutar este archivo (no requiere reset).
-- Evita pedidos duplicados si Stripe reintenta el webhook o se recupera a mano.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_stripe_checkout_session_id_uidx
  ON public.pedidos (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
