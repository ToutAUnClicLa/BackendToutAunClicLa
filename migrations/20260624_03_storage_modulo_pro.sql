-- =============================================================================
-- MÓDULO SERVICIOS PRO — Supabase Storage (buckets + políticas)
-- Día 2. Buckets públicos para lectura; subida/edición solo del dueño.
--
-- Convención de rutas: cada archivo vive en una carpeta con el user_id del
-- profesional -> '{auth.uid}/foto.jpg'. Así la política compara la 1ª carpeta
-- de la ruta con auth.uid().
-- =============================================================================

-- 1) Crear buckets públicos (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('pro-avatars', 'pro-avatars', true),
  ('pro-gallery', 'pro-gallery', true)
ON CONFLICT (id) DO NOTHING;


-- 2) Lectura pública (los buckets son públicos, pero dejamos la política explícita)
DROP POLICY IF EXISTS pol_pro_storage_lectura_publica ON storage.objects;
CREATE POLICY pol_pro_storage_lectura_publica ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('pro-avatars', 'pro-gallery'));


-- 3) Subida: solo el profesional autenticado, dentro de SU carpeta ({user_id}/...)
DROP POLICY IF EXISTS pol_pro_storage_subida_propia ON storage.objects;
CREATE POLICY pol_pro_storage_subida_propia ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('pro-avatars', 'pro-gallery')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- 4) Actualizar/eliminar: solo archivos en su propia carpeta
DROP POLICY IF EXISTS pol_pro_storage_update_propio ON storage.objects;
CREATE POLICY pol_pro_storage_update_propio ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('pro-avatars', 'pro-gallery')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS pol_pro_storage_delete_propio ON storage.objects;
CREATE POLICY pol_pro_storage_delete_propio ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('pro-avatars', 'pro-gallery')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Nota: el backend con service_role puede subir/borrar sin estas restricciones
-- (Día 4, upload de avatar con multer). Estas políticas protegen el acceso
-- directo desde el cliente anon/authenticated.
-- =============================================================================
