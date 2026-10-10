-- Renombra la categoría translation.
-- Textos = ToutAunClicLa/translations/{es,en,fr}.ts (services.categories.translation.title).
-- Forward-only. Idempotente. No editar 20260624_02_seed_modulo_pro.sql.

UPDATE pro_categorias
SET nombre_es = 'Lenguas y traducciones',
    nombre_en = 'Languages & translations',
    nombre_fr = 'Langues et traductions'
WHERE slug = 'translation';
