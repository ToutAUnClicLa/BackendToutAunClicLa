-- =============================================================================
-- MÓDULO SERVICIOS PRO — Seed de 3 categorías nuevas (es/en/fr)
-- employment, events, marketing. Orden 11, 12, 13.
-- Textos = ToutAunClicLa/translations/{es,en,fr}.ts (services.categories /
-- services.subservices). Iconos lucide: Briefcase, PartyPopper, Megaphone.
--
-- Forward-only. Idempotente: ON CONFLICT (slug) DO UPDATE.
-- Ejecutar DESPUÉS de 20260624_02_seed_modulo_pro.sql. No editar ese seed.
-- =============================================================================

INSERT INTO pro_categorias (slug, nombre_fr, nombre_en, nombre_es,
                            descripcion_fr, descripcion_en, descripcion_es, icono, orden)
VALUES
  ('employment',
   'Agents d''emploi', 'Employment agents', 'Agentes de empleo',
   'Recrutement, placement, CV et plus de professionnels pour votre recherche d''emploi.',
   'Recruitment, placement, resumes and more professionals for your job search.',
   'Reclutamiento, colocación, currículums y más profesionales para tu búsqueda de empleo.',
   'Briefcase', 11),

  ('events',
   'Fêtes et événements', 'Parties & events', 'Fiestas y eventos',
   'Mariages, anniversaires, traiteur et plus de professionnels pour vos fêtes et événements.',
   'Weddings, birthdays, catering and more professionals for your parties and events.',
   'Bodas, cumpleaños, catering y más profesionales para tus fiestas y eventos.',
   'PartyPopper', 12),

  ('marketing',
   'Publicité et marketing', 'Advertising & marketing', 'Publicidad y marketing',
   'Réseaux, annonces, marque et plus de professionnels pour faire connaître votre entreprise.',
   'Social, ads, branding and more professionals to promote your business.',
   'Redes, anuncios, marca y más profesionales para dar a conocer tu negocio.',
   'Megaphone', 13)
ON CONFLICT (slug) DO UPDATE SET
  nombre_fr      = EXCLUDED.nombre_fr,
  nombre_en      = EXCLUDED.nombre_en,
  nombre_es      = EXCLUDED.nombre_es,
  descripcion_fr = EXCLUDED.descripcion_fr,
  descripcion_en = EXCLUDED.descripcion_en,
  descripcion_es = EXCLUDED.descripcion_es,
  icono          = EXCLUDED.icono,
  orden          = EXCLUDED.orden;


INSERT INTO pro_subcategorias (categoria_id, slug, nombre_fr, nombre_en, nombre_es, orden)
SELECT c.id, v.slug, v.nombre_fr, v.nombre_en, v.nombre_es, v.orden
FROM (
  VALUES
    ('employment', 'recruitment', 'Recrutement',  'Recruitment', 'Reclutamiento', 1),
    ('employment', 'placement',   'Placement',    'Placement',   'Colocación',    2),
    ('employment', 'resumes',     'CV',           'Resumes',     'Currículums',   3),
    ('events',     'weddings',    'Mariages',     'Weddings',    'Bodas',         1),
    ('events',     'birthdays',   'Anniversaires','Birthdays',   'Cumpleaños',    2),
    ('events',     'catering',    'Traiteur',     'Catering',    'Catering',      3),
    ('marketing',  'social',      'Réseaux',      'Social',      'Redes',         1),
    ('marketing',  'ads',         'Annonces',     'Ads',         'Anuncios',      2),
    ('marketing',  'brand',       'Marque',       'Brand',       'Marca',         3)
) AS v(cat_slug, slug, nombre_fr, nombre_en, nombre_es, orden)
JOIN pro_categorias c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO UPDATE SET
  categoria_id = EXCLUDED.categoria_id,
  nombre_fr    = EXCLUDED.nombre_fr,
  nombre_en    = EXCLUDED.nombre_en,
  nombre_es    = EXCLUDED.nombre_es,
  orden        = EXCLUDED.orden;
