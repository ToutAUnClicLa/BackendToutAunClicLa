// =============================================================================
// MÓDULO PRO — Servicio del directorio (IO)
// Query paginada con filtros; ordenamiento por tier vive en proDirectorioLogic.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { rankPros, shapeForDirectory } from './proDirectorioLogic.js';

const TABLE = 'pro_profesionales';
const PAGE_DEFAULT = 1;
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

// Resuelve slug de categoría/subcategoría a UUID (una vez por request).
const resolveCategoria = async (slug) => {
  if (!slug) return null;
  const { data } = await supabaseAdmin
    .from('pro_categorias')
    .select('id').eq('slug', slug).eq('activo', true).maybeSingle();
  return data?.id || null;
};
const resolveSubcategoria = async (slug) => {
  if (!slug) return null;
  const { data } = await supabaseAdmin
    .from('pro_subcategorias')
    .select('id').eq('slug', slug).eq('activo', true).maybeSingle();
  return data?.id || null;
};

// Escape simple para ILIKE (evita que _ y % interpreten como wildcards).
const escapeILike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const listDirectorio = async (opts = {}) => {
  const {
    category = null,
    subcategory = null,
    idioma = null,
    ciudad = null,
    q = null,
    lang = 'fr',
    page = PAGE_DEFAULT,
    pageSize = PAGE_SIZE_DEFAULT,
  } = opts;

  const size = Math.min(Math.max(1, pageSize), PAGE_SIZE_MAX);
  const pageNum = Math.max(1, page);

  const [categoriaId, subcategoriaId] = await Promise.all([
    resolveCategoria(category),
    resolveSubcategoria(subcategory),
  ]);

  let query = supabaseAdmin
    .from(TABLE)
    .select(
      'id, slug, nombre, apellido, empresa, foto_url, titulo_fr, titulo_en, titulo_es, ' +
      'bio_fr, bio_en, bio_es, idioma_principal, idiomas_hablados, ciudad, ' +
      'categoria_id, subcategoria_id, tier, destacado, created_at',
      { count: 'exact' },
    )
    .eq('activo', true);

  if (categoriaId) query = query.eq('categoria_id', categoriaId);
  if (subcategoriaId) query = query.eq('subcategoria_id', subcategoriaId);
  if (idioma) query = query.contains('idiomas_hablados', [idioma]);
  if (ciudad) query = query.ilike('ciudad', `%${escapeILike(ciudad)}%`);
  if (q) {
    const like = `%${escapeILike(q)}%`;
    query = query.or(
      `nombre.ilike.${like},empresa.ilike.${like},titulo_fr.ilike.${like},` +
      `titulo_en.ilike.${like},titulo_es.ilike.${like}`,
    );
  }

  // Traemos suficientes para ranking, luego paginamos en memoria (la BD no
  // ordena por tier con orden custom; el rank fino se hace en JS).
  // Techo de seguridad: primeras 500 filas coincidentes de esta categoría.
  const HARD_LIMIT = 500;
  query = query
    .order('created_at', { ascending: false })
    .limit(HARD_LIMIT);

  const { data: pros = [], count } = await query;

  const ranked = rankPros(pros);
  const offset = (pageNum - 1) * size;
  const pageRows = ranked.slice(offset, offset + size);

  // Hidratamos redes solo de los que se van a mostrar (batch 1 query).
  const ids = pageRows.filter((p) => p.tier !== 'free').map((p) => p.id);
  let redesByPro = {};
  if (ids.length) {
    const { data: redes = [] } = await supabaseAdmin
      .from('pro_redes_sociales')
      .select('profesional_id, plataforma, url, orden')
      .in('profesional_id', ids)
      .order('orden', { ascending: true });
    redesByPro = redes.reduce((acc, r) => {
      (acc[r.profesional_id] ||= []).push(r);
      return acc;
    }, {});
  }

  const items = pageRows.map((p) => shapeForDirectory(p, lang, redesByPro[p.id] || []));

  return {
    items,
    page: pageNum,
    pageSize: size,
    total: count ?? ranked.length,
    totalPages: Math.max(1, Math.ceil((count ?? ranked.length) / size)),
  };
};

export { listDirectorio };
