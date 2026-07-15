// =============================================================================
// MÓDULO PRO — Servicio de tiers (IO)
// Fuente de verdad del tier: la suscripción activa/trialing (la escribirá el
// webhook de Stripe en la Semana 2). Mientras tanto, hace fallback a la columna
// cacheada pro_profesionales.tier, devolviendo el de MAYOR rango.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { TIER_RANK, hasTier, higherTier } from './proTierLogic.js';
import { isSubscriptionEffective } from './proBillingLogic.js';

// Tier derivado EN VIVO de las suscripciones del profesional, ignorando la
// columna cacheada. Es lo que corresponde escribir en pro_profesionales.tier:
// a diferencia de getEffectiveTier, no tiene un piso en el valor cacheado, así
// que sí puede bajar (p. ej. tras cancelar la única suscripción activa).
//
// isSubscriptionEffective (proBillingLogic.js) es la MISMA regla que usa
// getSubscriptionRow para elegir qué fila mostrar en el dashboard — si cada
// sitio reimplementa su propio "¿está vigente?" terminan desincronizados
// (tier diciendo 'max' mientras el dashboard muestra la suscripción 'pro'
// vieja, cancelada, solo porque fue la última en crearse).
const computeLiveTier = async (proId) => {
  // Todas las suscripciones marcadas trialing/active en la caché. Puede haber
  // filas obsoletas (un webhook de cancelación perdido las dejó "trialing"),
  // por eso isSubscriptionEffective descarta además las que ya vencieron por fecha.
  const { data: subs } = await supabaseAdmin
    .from('pro_suscripciones')
    .select('plan, estado, trial_fin, periodo_actual_fin')
    .eq('profesional_id', proId)
    .in('estado', ['trialing', 'active']);

  let tier = 'free';
  for (const s of subs || []) {
    if (isSubscriptionEffective(s)) tier = higherTier(tier, s.plan || 'free');
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
