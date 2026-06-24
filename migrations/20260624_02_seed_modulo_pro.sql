-- =============================================================================
-- MÓDULO SERVICIOS PRO — Seed de categorías y subcategorías (es/en/fr)
-- Día 2. Contenido tomado de ToutAunClicLa/translations/{fr,en,es}.ts
-- y de app/servicios/page.tsx (ids e iconos lucide).
--
-- Idempotente: ON CONFLICT (slug) DO UPDATE. Se puede correr varias veces.
-- Ejecutar DESPUÉS de 20260624_01_create_modulo_pro.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) CATEGORÍAS (10) — slug = id del front, icono = nombre lucide
-- -----------------------------------------------------------------------------
INSERT INTO pro_categorias (slug, nombre_fr, nombre_en, nombre_es,
                            descripcion_fr, descripcion_en, descripcion_es, icono, orden)
VALUES
  ('lawyers',
   'Services Juridiques', 'Legal Services', 'Servicios Legales',
   'Conseils juridiques experts en immigration, droit des sociétés et droit civil.',
   'Expert legal advice on immigration, corporate law, and civil law.',
   'Asesoría legal experta en inmigración, leyes corporativas y derecho civil.',
   'Gavel', 1),

  ('health',
   'Santé et Bien-être', 'Health & Wellness', 'Salud y Bienestar',
   'Soins médicaux complets ; médecins et spécialistes de la médecine et de votre bien-être dans votre région.',
   'Comprehensive medical care; doctors, and specialists in medicine and your well-being in your region.',
   'Cuidado médico integral; doctores, y especialistas de la medicina y de tu bienestar en tu región.',
   'Stethoscope', 2),

  ('accounting',
   'Comptabilité et Impôts', 'Accounting & Taxes', 'Contabilidad e Impuestos',
   'Gestion fiscale et comptable pour particuliers et entreprises.',
   'Tax and accounting management for individuals and businesses.',
   'Gestión fiscal y contable para particulares y empresas.',
   'Calculator', 3),

  ('finance',
   'Services Financiers', 'Financial Services', 'Servicios Financieros',
   'Planification financière, assurances et investissements pour votre avenir.',
   'Financial planning, insurance, and investments for your future.',
   'Planificación financiera, seguros e inversiones para tu futuro.',
   'TrendingUp', 4),

  ('realestate',
   'Immobilier', 'Real Estate', 'Bienes Raíces',
   'Achat, vente et location de propriétés avec des conseils d''experts.',
   'Buying, selling, and renting properties with expert advice.',
   'Compra, venta y renta de propiedades con asesoría experta.',
   'Home', 5),

  ('cars',
   'Automobile', 'Automotive', 'Automotriz',
   'Vente, réparation et entretien de véhicules.',
   'Vehicle sales, repair, and maintenance.',
   'Venta, reparación y mantenimiento de vehículos.',
   'Car', 6),

  ('beauty',
   'Beauté et Esthétique', 'Beauty & Aesthetics', 'Belleza y Estética',
   'Stylistes et professionnels de la beauté pour vous sublimer.',
   'Stylists and beauty professionals to make you look amazing.',
   'Estilistas y profesionales de belleza para lucir increíble.',
   'Scissors', 7),

  ('translation',
   'Traduction Officielle', 'Official Translation', 'Traducción Oficial',
   'Services de traduction certifiée pour vos documents importants.',
   'Certified translation services for your important documents.',
   'Servicios de traducción certificada para tus documentos importantes.',
   'Languages', 8),

  ('money',
   'Transferts d''Argent', 'Money Transfers', 'Envíos de Dinero',
   'Solutions rapides et sécurisées pour envoyer de l''argent dans votre pays.',
   'Fast and secure solutions to send money to your country.',
   'Soluciones rápidas y seguras para enviar dinero a tu país.',
   'BadgeDollarSign', 9),

  ('maintenance',
   'Entretien et Construction', 'Maintenance & Construction', 'Mantenimiento y Construcción',
   'Electriciens, plombiers, peintres et plus de professionnels pour votre maison ou entreprise.',
   'Electricians, plumbers, painters and more professionals for your home or business.',
   'Electricistas, plomeros, pintores y más profesionales para tu hogar o negocio.',
   'Wrench', 10)
ON CONFLICT (slug) DO UPDATE SET
  nombre_fr      = EXCLUDED.nombre_fr,
  nombre_en      = EXCLUDED.nombre_en,
  nombre_es      = EXCLUDED.nombre_es,
  descripcion_fr = EXCLUDED.descripcion_fr,
  descripcion_en = EXCLUDED.descripcion_en,
  descripcion_es = EXCLUDED.descripcion_es,
  icono          = EXCLUDED.icono,
  orden          = EXCLUDED.orden;


-- -----------------------------------------------------------------------------
-- 2) SUBCATEGORÍAS (~32) — categoria_id resuelto por slug de la categoría
--    (se excluye 'manyMore' porque es un placeholder de UI, no una subcategoría)
-- -----------------------------------------------------------------------------
INSERT INTO pro_subcategorias (categoria_id, slug, nombre_fr, nombre_en, nombre_es, orden)
SELECT c.id, v.slug, v.nombre_fr, v.nombre_en, v.nombre_es, v.orden
FROM (
  VALUES
    -- lawyers
    ('lawyers','lawyers',   'Avocats',        'Lawyers',        'Abogados',                   1),
    ('lawyers','notaries',  'Notaires',       'Notaries',       'Notarios',                   2),
    ('lawyers','migration', 'Immigration',    'Migration',      'Migración',                  3),
    ('lawyers','civil',     'Civil',          'Civil',          'Civil',                      4),
    -- health
    ('health','doctors',         'Médecins',        'Doctors',          'Médicos',                  1),
    ('health','dentists',        'Dentistes',       'Dentists',         'Dentistas',                2),
    ('health','psychologists',   'Psychologues',    'Psychologists',    'Psicólogos',               3),
    ('health','psychotherapists','Psychothérapeutes','Psychotherapists','Psicoterapeutas',          4),
    ('health','speechTherapists','Orthophonistes',  'Speech Therapists','Especialistas del lenguaje',5),
    ('health','optometrists',    'Optométristes',   'Optometrists',     'Optometristas',            6),
    ('health','sexologists',     'Sexologues',      'Sexologists',      'Sexólogos',                7),
    -- accounting
    ('accounting','taxes',      'Impôts',          'Taxes',      'Impuestos', 1),
    ('accounting','payroll',    'Paie',            'Payroll',    'Nómina',    2),
    ('accounting','bookkeeping','Tenue de livres', 'Bookkeeping','Libros',    3),
    -- finance
    ('finance','insurance',   'Assurances',     'Insurance',   'Seguros',     1),
    ('finance','investments', 'Investissements','Investments', 'Inversiones', 2),
    -- realestate
    ('realestate','buying',     'Achat',     'Buying',     'Compra',    1),
    ('realestate','renting',    'Location',  'Renting',    'Renta',     2),
    ('realestate','commercial', 'Commercial','Commercial', 'Comercial', 3),
    -- cars
    ('cars','dealerships', 'Concessionnaires','Dealerships','Concesionarios', 1),
    ('cars','mechanics',   'Mécanique',       'Mechanics',  'Mecánica',       2),
    -- beauty
    ('beauty','stylists', 'Stylistes','Stylists','Estilistas', 1),
    ('beauty','nails',    'Ongles',   'Nails',   'Uñas',       2),
    ('beauty','barber',   'Barbier',  'Barber',  'Barbería',   3),
    -- translation
    ('translation','official',       'Officiel',      'Official',       'Oficial',        1),
    ('translation','interpretation', 'Interprétation','Interpretation', 'Interpretación', 2),
    -- money
    ('money','remittances', 'Envois de fonds','Remittances',     'Remesas',          1),
    ('money','exchange',    'Change',         'Currency Exchange','Cambio de Divisas',2),
    -- maintenance
    ('maintenance','electricians','Electriciens','Electricians','Electricistas', 1),
    ('maintenance','plumbers',    'Plombiers',   'Plumbers',    'Plomeros',      2),
    ('maintenance','painters',    'Peintres',    'Painters',    'Pintores',      3),
    ('maintenance','carpenters',  'Charpentiers','Carpenters',  'Carpinteros',   4),
    ('maintenance','locksmiths',  'Serruriers',  'Locksmiths',  'Cerrajeros',    5)
) AS v(cat_slug, slug, nombre_fr, nombre_en, nombre_es, orden)
JOIN pro_categorias c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO UPDATE SET
  categoria_id = EXCLUDED.categoria_id,
  nombre_fr    = EXCLUDED.nombre_fr,
  nombre_en    = EXCLUDED.nombre_en,
  nombre_es    = EXCLUDED.nombre_es,
  orden        = EXCLUDED.orden;

-- =============================================================================
-- Verificación rápida (descomentar para inspeccionar):
--   SELECT c.slug, COUNT(s.id) AS subcategorias
--   FROM pro_categorias c
--   LEFT JOIN pro_subcategorias s ON s.categoria_id = c.id
--   GROUP BY c.slug ORDER BY MIN(c.orden);
-- =============================================================================
