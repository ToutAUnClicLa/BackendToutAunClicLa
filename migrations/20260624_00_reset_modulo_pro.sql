-- =============================================================================
-- MÓDULO SERVICIOS PRO — Reset (solo en desarrollo, SIN datos reales)
--
-- Borra las tablas del módulo para recrearlas limpias. Úsalo SOLO si el módulo
-- aún no tiene profesionales/datos que conservar. CASCADE elimina dependencias.
--
-- Después de este script, ejecutar en orden:
--   1. 20260624_01_create_modulo_pro.sql
--   2. 20260624_02_seed_modulo_pro.sql
--   3. 20260624_03_storage_modulo_pro.sql
-- =============================================================================

DROP TABLE IF EXISTS pro_analytics          CASCADE;
DROP TABLE IF EXISTS pro_galeria            CASCADE;
DROP TABLE IF EXISTS pro_tarjetas_digitales CASCADE;
DROP TABLE IF EXISTS pro_suscripciones      CASCADE;
DROP TABLE IF EXISTS pro_redes_sociales     CASCADE;
DROP TABLE IF EXISTS pro_profesionales      CASCADE;
DROP TABLE IF EXISTS pro_subcategorias      CASCADE;
DROP TABLE IF EXISTS pro_categorias         CASCADE;

-- La función pro_set_updated_at() se recrea con CREATE OR REPLACE en el create,
-- no hace falta borrarla.
