// =============================================================================
// MÓDULO PRO — Servicio de datos (sin HTTP)
// Helpers reutilizables sobre la tabla pro_profesionales. La lógica de negocio
// vive aquí; los controladores solo orquestan request/response.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';

const TABLE = 'pro_profesionales';

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

// Genera un slug único: 'juan-perez', y si existe 'juan-perez-2', etc.
const generateUniqueSlug = async (nombre, apellido = '') => {
  const base = slugify(`${nombre} ${apellido}`) || 'pro';
  let slug = base;
  let n = 1;

  // Busca colisiones hasta encontrar uno libre
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabaseAdmin
      .from(TABLE)
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
};

const findProByEmail = async (email) => {
  const { data } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('email', email)
    .maybeSingle();
  return data;
};

const findProById = async (id) => {
  const { data } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data;
};

const findProBySlug = async (slug) => {
  const { data } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return data;
};

// Valida que la categoría exista y que la subcategoría (si viene) pertenezca a
// ella. Devuelve { ok: true } o { ok: false, message }.
const validateCategoria = async (categoriaId, subcategoriaId) => {
  if (categoriaId) {
    const { data: cat } = await supabaseAdmin
      .from('pro_categorias').select('id').eq('id', categoriaId).maybeSingle();
    if (!cat) return { ok: false, message: 'Categoría no encontrada' };
  }
  if (subcategoriaId) {
    const { data: sub } = await supabaseAdmin
      .from('pro_subcategorias').select('id, categoria_id').eq('id', subcategoriaId).maybeSingle();
    if (!sub) return { ok: false, message: 'Subcategoría no encontrada' };
    if (categoriaId && sub.categoria_id !== categoriaId) {
      return { ok: false, message: 'La subcategoría no pertenece a la categoría indicada' };
    }
  }
  return { ok: true };
};

const createPro = async (payload) => {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

const updatePro = async (id, patch) => {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

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

export {
  slugify,
  generateUniqueSlug,
  findProByEmail,
  findProById,
  findProBySlug,
  validateCategoria,
  createPro,
  updatePro,
  sanitizePro,
  publicProfile,
};
