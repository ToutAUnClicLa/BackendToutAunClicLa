// =============================================================================
// MÓDULO PRO — Servicio de datos (IO sobre pro_profesionales)
// La lógica pura de serialización vive en proSerializers.js (testeable sin DB).
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { slugify, sanitizePro, publicProfile } from './proSerializers.js';

const TABLE = 'pro_profesionales';

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

export {
  // IO
  generateUniqueSlug,
  findProByEmail,
  findProById,
  findProBySlug,
  validateCategoria,
  createPro,
  updatePro,
  // re-export de serializers puros (compatibilidad con imports existentes)
  slugify,
  sanitizePro,
  publicProfile,
};
