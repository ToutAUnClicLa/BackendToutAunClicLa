// =============================================================================
// MÓDULO PRO — Catálogo (categorías + subcategorías) para el directorio y forms
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';

// Devuelve las categorías activas (trilingües) con sus subcategorías anidadas.
const listCategorias = async () => {
  const { data: cats } = await supabaseAdmin
    .from('pro_categorias')
    .select('id, slug, nombre_fr, nombre_en, nombre_es, descripcion_fr, descripcion_en, descripcion_es, icono, orden')
    .eq('activo', true)
    .order('orden', { ascending: true });

  const { data: subs } = await supabaseAdmin
    .from('pro_subcategorias')
    .select('id, categoria_id, slug, nombre_fr, nombre_en, nombre_es, orden')
    .eq('activo', true)
    .order('orden', { ascending: true });

  const porCategoria = {};
  (subs || []).forEach((s) => {
    (porCategoria[s.categoria_id] ||= []).push(s);
  });

  return (cats || []).map((c) => ({ ...c, subcategorias: porCategoria[c.id] || [] }));
};

export { listCategorias };
