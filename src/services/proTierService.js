// =============================================================================
// MÓDULO PRO — Servicio de tiers (IO)
// Fuente de verdad del tier: la suscripción activa/trialing (la escribirá el
// webhook de Stripe en la Semana 2). Mientras tanto, hace fallback a la columna
// cacheada pro_profesionales.tier, devolviendo el de MAYOR rango.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { TIER_RANK, hasTier, higherTier } from './proTierLogic.js';

// Tier derivado EN VIVO de las suscripciones del profesional, ignorando la
// columna cacheada. Es lo que corresponde escribir en pro_profesionales.tier:
// a diferencia de getEffectiveTier, no tiene un piso en el valor cacheado, así
// que sí puede bajar (p. ej. tras cancelar la única suscripción activa).
const computeLiveTier = async (proId) => {
  // Todas las suscripciones marcadas trialing/active en la caché. Puede haber
  // filas obsoletas (un webhook de cancelación perdido las dejó "trialing"),
  // por eso NO basta con el estado: descartamos las que ya vencieron por fecha.
  const { data: subs } = await supabaseAdmin
    .from('pro_suscripciones')
    .select('plan, estado, trial_fin, periodo_actual_fin')
    .eq('profesional_id', proId)
    .in('estado', ['trialing', 'active']);

  const now = Date.now();
  const isExpired = (s) =>
    (s.estado === 'trialing' && s.trial_fin && new Date(s.trial_fin).getTime() < now) ||
    (s.estado === 'active' && s.periodo_actual_fin && new Date(s.periodo_actual_fin).getTime() < now);

  let tier = 'free';
  for (const s of subs || []) {
    if (!isExpired(s)) tier = higherTier(tier, s.plan || 'free');
  }
  return tier;
};

// Acepta el objeto profesional (con .id y .tier) o un id suelto.
const getEffectiveTier = async (proOrId) => {
  let cachedTier = 'free';
  let proId = proOrId;

  if (proOrId && typeof proOrId === 'object') {
    cachedTier = proOrId.tier || 'free';
    proId = proOrId.id;
  }

  const liveTier = await computeLiveTier(proId);
  return higherTier(liveTier, cachedTier);
};

export { TIER_RANK, hasTier, getEffectiveTier, computeLiveTier };
