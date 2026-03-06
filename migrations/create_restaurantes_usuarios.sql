-- Script para crear la tabla de usuarios de restaurantes

CREATE TABLE IF NOT EXISTS restaurantes_usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurante_id BIGINT REFERENCES subcategorias(id) ON DELETE CASCADE,
  username VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- RLS (Row Level Security) - opcional si interactuamos sólo desde servidor con service_role
ALTER TABLE restaurantes_usuarios ENABLE ROW LEVEL SECURITY;

-- Índice para búsqueda rápida por username
CREATE INDEX idx_restaurantes_username ON restaurantes_usuarios(username);
