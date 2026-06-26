// =============================================================================
// MÓDULO PRO — Lógica pura de serialización (SIN IO / sin Supabase)
// Separado del servicio para poder testearlo sin DB ni variables de entorno.
// =============================================================================

// 'Juan Pérez' -> 'juan-perez'
const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s-]/g, '')    // solo alfanumérico, espacio y guion
    .replace(/\s+/g, '-')             // espacios -> guion
    .replace(/-+/g, '-');             // colapsar guiones

// VISTA PRIVADA — todos los campos editables del propio profesional.
// Nunca incluye password_hash ni el token de verificación. Úsalo en /me.
const sanitizePro = (pro) => ({
  id: pro.id,
  email: pro.email,
  slug: pro.slug,
  nombre: pro.nombre,
  apellido: pro.apellido,
  empresa: pro.empresa,
  foto_url: pro.foto_url,
  titulo_fr: pro.titulo_fr,
  titulo_en: pro.titulo_en,
  titulo_es: pro.titulo_es,
  bio_fr: pro.bio_fr,
  bio_en: pro.bio_en,
  bio_es: pro.bio_es,
  idioma_principal: pro.idioma_principal,
  idiomas_hablados: pro.idiomas_hablados,
  telefono: pro.telefono,
  sitio_web: pro.sitio_web,
  ciudad: pro.ciudad,
  codigo_postal: pro.codigo_postal,
  categoria_id: pro.categoria_id,
  subcategoria_id: pro.subcategoria_id,
  tier: pro.tier,
  destacado: pro.destacado,
  verificado: pro.verificado,
  autenticacion_social: pro.autenticacion_social,
  activo: pro.activo,
  created_at: pro.created_at,
  updated_at: pro.updated_at,
});

// Resuelve un campo trilingüe (titulo/bio) según el idioma del visitante,
// con fallback al idioma_principal y luego a cualquiera disponible.
const resolveLang = (pro, field, lang) => {
  const order = [lang, pro.idioma_principal, 'fr', 'en', 'es'];
  for (const l of order) {
    const value = pro[`${field}_${l}`];
    if (value) return value;
  }
  return null;
};

// VISTA PÚBLICA — perfil para /card/:slug. No expone email, código postal,
// ni flags internos. titulo/bio ya resueltos al idioma del visitante.
const publicProfile = (pro, lang = 'fr') => ({
  slug: pro.slug,
  nombre: pro.nombre,
  apellido: pro.apellido,
  empresa: pro.empresa,
  foto_url: pro.foto_url,
  titulo: resolveLang(pro, 'titulo', lang),
  bio: resolveLang(pro, 'bio', lang),
  telefono: pro.telefono,
  sitio_web: pro.sitio_web,
  ciudad: pro.ciudad,
  idiomas_hablados: pro.idiomas_hablados,
  categoria_id: pro.categoria_id,
  subcategoria_id: pro.subcategoria_id,
  tier: pro.tier,
  destacado: pro.destacado,
});

export { slugify, sanitizePro, resolveLang, publicProfile };
