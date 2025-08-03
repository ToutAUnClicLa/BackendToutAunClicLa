-- Agregar columnas para Google OAuth a la tabla usuarios
-- Ejecutar solo si las columnas no existen

-- Agregar columnas para autenticación social
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS autenticacion_social BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proveedor_social VARCHAR(50),
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS url_avatar TEXT;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_usuarios_google_id ON usuarios(google_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_autenticacion_social ON usuarios(autenticacion_social);
CREATE INDEX IF NOT EXISTS idx_usuarios_proveedor_social ON usuarios(proveedor_social);

-- Comentarios para documentación
COMMENT ON COLUMN usuarios.autenticacion_social IS 'Indica si el usuario se registró/logueó usando autenticación social';
COMMENT ON COLUMN usuarios.proveedor_social IS 'Proveedor de autenticación social (google, facebook, etc.)';
COMMENT ON COLUMN usuarios.google_id IS 'ID único del usuario en Google';
COMMENT ON COLUMN usuarios.url_avatar IS 'URL del avatar del usuario';
