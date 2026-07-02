// =============================================================================
// MÓDULO PRO — Lógica pura del directorio (SIN IO)
// Ordenamiento por tier + shape del payload según tier del profesional.
// =============================================================================
import { resolveLang } from './proSerializers.js';

// Ranking del directorio: destacados primero (Max), luego Max no destacados,
// luego Pro, luego Free. Dentro de cada tier, más recientes arriba.
const TIER_ORDER = { max: 2, pro: 1, free: 0 };

const rankScore = (pro) => {
  const tier = TIER_ORDER[pro.tier] ?? 0;
  const destacado = tier === 2 && pro.destacado ? 1 : 0;
  return tier * 10 + destacado;
};

const rankPros = (pros) =>
  [...pros].sort((a, b) => {
    const scoreDiff = rankScore(b) - rankScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    // desempate: más reciente primero
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

// Base común (todos los tiers) — nombre, slug, categoría.
const baseShape = (pro) => ({
  slug: pro.slug,
  nombre: pro.nombre,
  apellido: pro.apellido,
  categoria_id: pro.categoria_id,
  subcategoria_id: pro.subcategoria_id,
  tier: pro.tier,
});

// Payload público según el tier: Free = básico, Pro = con foto/título/redes,
// Max = todo + bio + destacado. Nunca expone email/teléfono privado en el
// listado (esos se ven al abrir el perfil).
const shapeForDirectory = (pro, lang = 'fr', redes = []) => {
  const base = baseShape(pro);
  if (pro.tier === 'free') return base;

  const pro_shape = {
    ...base,
    empresa: pro.empresa,
    foto_url: pro.foto_url,
    titulo: resolveLang(pro, 'titulo', lang),
    ciudad: pro.ciudad,
    idiomas_hablados: pro.idiomas_hablados || [],
    redes: redes.slice(0, 3).map((r) => ({ plataforma: r.plataforma, url: r.url })),
  };
  if (pro.tier === 'pro') return pro_shape;

  // max
  return {
    ...pro_shape,
    bio: resolveLang(pro, 'bio', lang),
    destacado: !!pro.destacado,
    redes: redes.map((r) => ({ plataforma: r.plataforma, url: r.url })),
  };
};

export { TIER_ORDER, rankScore, rankPros, shapeForDirectory };
