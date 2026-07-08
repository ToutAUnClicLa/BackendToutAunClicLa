-- =============================================================================
-- MÓDULO PRO — Añade email_contacto al profesional
-- Forward-only: solo ejecutar este archivo (no requiere reset).
-- Email PÚBLICO de contacto, SEPARADO del email de login (privado).
-- El profesional puede dejarlo vacío; se muestra en el perfil público y la vCard.
-- =============================================================================

ALTER TABLE pro_profesionales
  ADD COLUMN IF NOT EXISTS email_contacto VARCHAR;
