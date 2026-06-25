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

// Devuelve solo los campos públicos/seguros del profesional (nunca el hash ni
// el token de verificación). Úsalo en TODA respuesta HTTP.
const sanitizePro = (pro) => ({
  id: pro.id,
  email: pro.email,
  slug: pro.slug,
  nombre: pro.nombre,
  apellido: pro.apellido,
  telefono: pro.telefono,
  empresa: pro.empresa,
  foto_url: pro.foto_url,
  idioma_principal: pro.idioma_principal,
  verificado: pro.verificado,
  autenticacion_social: pro.autenticacion_social,
  tier: pro.tier,
  categoria_id: pro.categoria_id,
  subcategoria_id: pro.subcategoria_id,
  created_at: pro.created_at,
});

export {
  slugify,
  generateUniqueSlug,
  findProByEmail,
  findProById,
  createPro,
  updatePro,
  sanitizePro,
};
