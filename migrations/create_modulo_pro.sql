-- =============================================================================
-- MÓDULO SERVICIOS PRO — Tarjetas digitales profesionales y directorio local
-- Día 1: Modelado de datos completo
--
-- Convenciones del proyecto:
--   - PK UUID con uuid_generate_v4()
--   - TIMESTAMPTZ DEFAULT NOW()
--   - RLS habilitado (el backend opera con service_role y lo bypassa;
--     las políticas son red de seguridad para el cliente anon)
-- =============================================================================

-- Extensión necesaria para uuid_generate_v4() (idempotente)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Trigger genérico para mantener updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pro_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 1. CATEGORÍAS — nichos del directorio (estética, inmobiliario, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_categorias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR UNIQUE NOT NULL,        -- 'esthetique', 'immobilier'
  -- Nombre en los 3 idiomas de la plataforma (fr primario por Loi 96)
  nombre_fr   VARCHAR NOT NULL,
  nombre_en   VARCHAR NOT NULL,
  nombre_es   VARCHAR NOT NULL,
  icono       VARCHAR,                         -- nombre del icono (lucide)
  orden       INTEGER DEFAULT 0,               -- orden de aparición
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_categorias_slug   ON pro_categorias(slug);
CREATE INDEX IF NOT EXISTS idx_pro_categorias_activo ON pro_categorias(activo);


-- =============================================================================
-- 2. PROFESIONALES — perfil. Identidad delegada a Supabase Auth
--    (soporta Google, Microsoft/Outlook, Apple, email/password y magic links
--     sin código propio). Esta tabla es el "perfil" ligado a auth.users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_profesionales (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identidad (Supabase Auth)
  user_id        UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email          VARCHAR,   -- copia cacheada desde auth.users (listados/queries)

  -- Identidad pública
  slug           VARCHAR UNIQUE NOT NULL,      -- 'juan-perez' -> /card/juan-perez
  nombre         VARCHAR NOT NULL,
  apellido       VARCHAR,
  empresa        VARCHAR,
  foto_url       VARCHAR,                       -- Supabase Storage: pro-avatars

  -- Título profesional en los 3 idiomas (el perfil público muestra el del
  -- idioma del visitante, con fallback al idioma_principal)
  titulo_fr      VARCHAR,                       -- 'Coiffeuse', 'Courtier immobilier'
  titulo_en      VARCHAR,
  titulo_es      VARCHAR,

  -- Bio en los 3 idiomas (misma lógica de fallback)
  bio_fr         TEXT,
  bio_en         TEXT,
  bio_es         TEXT,

  -- Idioma en el que el profesional rellenó primero (fallback de visualización)
  idioma_principal VARCHAR NOT NULL DEFAULT 'fr'
                     CHECK (idioma_principal IN ('fr', 'en', 'es')),

  -- Contacto
  telefono       VARCHAR,
  sitio_web      VARCHAR,
  ciudad         VARCHAR,
  codigo_postal  VARCHAR,

  -- Idiomas que habla el profesional con sus clientes (filtrable en el
  -- directorio). Códigos ISO: 'fr','en','es','it','ar','pt','zh', etc.
  idiomas_hablados TEXT[] DEFAULT '{}',

  -- Clasificación
  categoria_id   UUID REFERENCES pro_categorias(id) ON DELETE SET NULL,

  -- Plan y visibilidad
  tier           VARCHAR NOT NULL DEFAULT 'free'
                   CHECK (tier IN ('free', 'pro', 'max')),
  destacado      BOOLEAN DEFAULT false,         -- listado prioritario (Max)
  activo         BOOLEAN DEFAULT true,

  -- Auditoría
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_prof_slug       ON pro_profesionales(slug);
CREATE INDEX IF NOT EXISTS idx_pro_prof_user       ON pro_profesionales(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_prof_categoria  ON pro_profesionales(categoria_id);
-- Índice GIN para filtrar el directorio por idioma hablado (array)
CREATE INDEX IF NOT EXISTS idx_pro_prof_idiomas    ON pro_profesionales USING GIN (idiomas_hablados);
-- Índice compuesto para el ordenamiento del directorio (tier desc, destacado, fecha)
CREATE INDEX IF NOT EXISTS idx_pro_prof_directorio
  ON pro_profesionales(categoria_id, tier, destacado, created_at)
  WHERE activo = true;

CREATE TRIGGER trg_pro_prof_updated_at
  BEFORE UPDATE ON pro_profesionales
  FOR EACH ROW EXECUTE FUNCTION pro_set_updated_at();


-- =============================================================================
-- 3. REDES SOCIALES — links del perfil (Pro: máx 5, Max: ilimitado)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_redes_sociales (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id UUID NOT NULL REFERENCES pro_profesionales(id) ON DELETE CASCADE,
  plataforma    VARCHAR NOT NULL,              -- 'instagram', 'linkedin', 'tiktok'
  url           VARCHAR NOT NULL,
  orden         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_redes_profesional ON pro_redes_sociales(profesional_id);


-- =============================================================================
-- 4. SUSCRIPCIONES — espejo del estado de Stripe
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_suscripciones (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id         UUID NOT NULL REFERENCES pro_profesionales(id) ON DELETE CASCADE,

  -- Referencias Stripe
  stripe_customer_id     VARCHAR,
  stripe_subscription_id VARCHAR UNIQUE,
  stripe_price_id        VARCHAR,

  -- Plan
  plan                   VARCHAR NOT NULL
                           CHECK (plan IN ('pro', 'max')),
  periodo                VARCHAR NOT NULL DEFAULT 'mensual'
                           CHECK (periodo IN ('mensual', 'anual')),

  -- Estado del ciclo de vida (refleja los estados de Stripe)
  estado                 VARCHAR NOT NULL DEFAULT 'trialing'
                           CHECK (estado IN ('trialing','active','past_due',
                                             'canceled','incomplete','unpaid')),
  trial_fin              TIMESTAMPTZ,
  periodo_actual_fin     TIMESTAMPTZ,
  cancelar_al_final      BOOLEAN DEFAULT false,

  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_subs_profesional ON pro_suscripciones(profesional_id);
CREATE INDEX IF NOT EXISTS idx_pro_subs_stripe_sub  ON pro_suscripciones(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pro_subs_estado      ON pro_suscripciones(estado);

CREATE TRIGGER trg_pro_subs_updated_at
  BEFORE UPDATE ON pro_suscripciones
  FOR EACH ROW EXECUTE FUNCTION pro_set_updated_at();


-- =============================================================================
-- 5. TARJETAS DIGITALES — pases emitidos (Apple Wallet / Google Wallet)
--    Necesario para el web service de actualización push (PassKit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_tarjetas_digitales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id   UUID NOT NULL REFERENCES pro_profesionales(id) ON DELETE CASCADE,
  plataforma       VARCHAR NOT NULL DEFAULT 'apple'
                     CHECK (plataforma IN ('apple', 'google')),

  -- Identificadores del pase (PassKit)
  serial_number    VARCHAR UNIQUE NOT NULL,     -- serialNumber del .pkpass
  auth_token       VARCHAR NOT NULL,            -- authenticationToken del pase
  device_libs      JSONB DEFAULT '[]'::jsonb,   -- deviceLibraryIdentifiers registrados

  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(), -- para el header de PassKit
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_tarjetas_profesional ON pro_tarjetas_digitales(profesional_id);
CREATE INDEX IF NOT EXISTS idx_pro_tarjetas_serial      ON pro_tarjetas_digitales(serial_number);


-- =============================================================================
-- 6. GALERÍA — portafolio (solo tier Max, hasta 10 imágenes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_galeria (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id UUID NOT NULL REFERENCES pro_profesionales(id) ON DELETE CASCADE,
  imagen_url     VARCHAR NOT NULL,              -- Supabase Storage: pro-gallery
  titulo         VARCHAR,
  descripcion    VARCHAR,
  orden          INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_galeria_profesional ON pro_galeria(profesional_id);


-- =============================================================================
-- 7. ANALYTICS — eventos del perfil (vistas, clics, vCard, scans QR)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pro_analytics (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id UUID NOT NULL REFERENCES pro_profesionales(id) ON DELETE CASCADE,
  evento         VARCHAR NOT NULL
                   CHECK (evento IN ('vista_perfil','clic_red','descarga_vcard',
                                     'scan_qr','add_wallet','clic_telefono','clic_web')),
  metadata       JSONB DEFAULT '{}'::jsonb,     -- { red: 'instagram', fuente: 'directorio' }
  ip_hash        VARCHAR,                        -- IP hasheada (Loi 25 / privacidad)
  user_agent     VARCHAR,
  ciudad         VARCHAR,                        -- solo Max: geolocalización aproximada
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_analytics_profesional ON pro_analytics(profesional_id);
CREATE INDEX IF NOT EXISTS idx_pro_analytics_evento_fecha ON pro_analytics(profesional_id, evento, created_at);


-- =============================================================================
-- ROW LEVEL SECURITY
-- El backend usa service_role (bypassa RLS). Estas políticas protegen el
-- acceso del cliente anon: lectura pública de datos de perfiles activos,
-- y ninguna escritura desde el cliente.
-- =============================================================================
ALTER TABLE pro_categorias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_profesionales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_redes_sociales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_suscripciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_tarjetas_digitales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_galeria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_analytics          ENABLE ROW LEVEL SECURITY;

-- Lectura pública: categorías activas
DROP POLICY IF EXISTS pol_categorias_lectura_publica ON pro_categorias;
CREATE POLICY pol_categorias_lectura_publica ON pro_categorias
  FOR SELECT TO anon, authenticated
  USING (activo = true);

-- Lectura pública: perfiles activos (directorio + perfil público)
DROP POLICY IF EXISTS pol_prof_lectura_publica ON pro_profesionales;
CREATE POLICY pol_prof_lectura_publica ON pro_profesionales
  FOR SELECT TO anon, authenticated
  USING (activo = true);

-- Gestión propia: el profesional autenticado lee/edita SU fila (auth.uid()).
-- Permite además ver sus campos aunque el perfil esté inactivo.
DROP POLICY IF EXISTS pol_prof_gestion_propia ON pro_profesionales;
CREATE POLICY pol_prof_gestion_propia ON pro_profesionales
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lectura pública: redes sociales de perfiles activos
DROP POLICY IF EXISTS pol_redes_lectura_publica ON pro_redes_sociales;
CREATE POLICY pol_redes_lectura_publica ON pro_redes_sociales
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pro_profesionales p
      WHERE p.id = profesional_id AND p.activo = true
    )
  );

-- Lectura pública: galería de perfiles activos
DROP POLICY IF EXISTS pol_galeria_lectura_publica ON pro_galeria;
CREATE POLICY pol_galeria_lectura_publica ON pro_galeria
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pro_profesionales p
      WHERE p.id = profesional_id AND p.activo = true
    )
  );

-- Suscripciones, tarjetas y analytics: SIN política para anon/authenticated.
-- Sin política => acceso denegado al cliente. Solo el backend (service_role)
-- puede leerlas/escribirlas. Es el comportamiento deseado.
