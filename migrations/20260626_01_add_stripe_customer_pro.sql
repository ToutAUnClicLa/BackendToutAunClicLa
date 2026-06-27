-- =============================================================================
-- MÓDULO PRO — Añade stripe_customer_id al profesional
-- Forward-only: solo ejecutar este archivo (no requiere reset).
-- Un cliente de Stripe por profesional, independiente del ciclo de suscripción.
-- =============================================================================

ALTER TABLE pro_profesionales
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_pro_prof_stripe_customer
  ON pro_profesionales(stripe_customer_id);
