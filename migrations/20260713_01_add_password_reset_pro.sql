-- =============================================================================
-- MÓDULO PRO — Recuperación de contraseña (mismo patrón que 'usuarios')
-- Forward-only: solo ejecutar este archivo (no requiere reset).
-- Código de 6 dígitos + expiración, igual que token_verificacion_email.
-- =============================================================================

ALTER TABLE pro_profesionales
  ADD COLUMN IF NOT EXISTS token_reset_password    VARCHAR,
  ADD COLUMN IF NOT EXISTS fecha_expiracion_reset   TIMESTAMPTZ;
