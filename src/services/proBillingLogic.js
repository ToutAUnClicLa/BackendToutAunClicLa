// =============================================================================
// MÓDULO PRO — Lógica pura de facturación (SIN IO). Testeable sin Stripe.
// Mapea priceId ↔ { plan, periodo } a partir de un objeto de price IDs.
// =============================================================================
import { TIER_RANK } from './proTierLogic.js';

const PLANS = ['pro', 'max'];
const PERIODOS = ['mensual', 'anual'];

// Construye los índices de búsqueda en ambas direcciones.
// priceIds: { proMensual, proAnual, maxMensual, maxAnual }
const buildBillingMaps = (priceIds = {}) => {
  const entries = [
    ['pro', 'mensual', priceIds.proMensual],
    ['pro', 'anual', priceIds.proAnual],
    ['max', 'mensual', priceIds.maxMensual],
    ['max', 'anual', priceIds.maxAnual],
  ];

  const byId = {};        // price_xxx -> { plan, periodo }
  const byPlanPeriodo = {}; // 'pro:mensual' -> price_xxx

  for (const [plan, periodo, id] of entries) {
    if (!id) continue;
    byId[id] = { plan, periodo };
    byPlanPeriodo[`${plan}:${periodo}`] = id;
  }

  return { byId, byPlanPeriodo };
};

// price_xxx -> { plan, periodo } | null
const resolveByPriceId = (priceId, maps) => maps.byId[priceId] || null;

// (plan, periodo) -> price_xxx | null
const resolvePriceId = (plan, periodo, maps) => maps.byPlanPeriodo[`${plan}:${periodo}`] || null;

// Valida la combinación plan/periodo
const isValidPlanPeriodo = (plan, periodo) =>
  PLANS.includes(plan) && PERIODOS.includes(periodo);

// --- Mappers de webhook (puros) ---------------------------------------------

// Estado de Stripe -> nuestro enum de pro_suscripciones.estado
const STATUS_MAP = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'past_due',
};
const mapStripeStatus = (stripeStatus) => STATUS_MAP[stripeStatus] || 'incomplete';

// Tier a escribir en la caché según el estado. null = NO cambiar (gracia).
const tierForStatus = (estado, plan) => {
  if (estado === 'active' || estado === 'trialing') return plan;
  if (estado === 'canceled' || estado === 'unpaid') return 'free';
  return null; // past_due / incomplete -> conserva el acceso durante reintentos
};

// Intervalo de Stripe ('month'/'year') -> nuestro periodo
const periodoFromInterval = (interval) =>
  interval === 'year' ? 'anual' : 'mensual';

// Parámetros de Stripe Checkout para impuestos (GST/QST Quebec).
// billing_address_collection y customer_update siempre activos: Stripe necesita
// la dirección para calcular impuestos cuando la flag se active.
// automatic_tax sólo se habilita con STRIPE_TAX_ENABLED=true (requiere registros
// fiscales reales en el Stripe Dashboard antes de activar).
const buildCheckoutTaxParams = (taxEnabled) => ({
  billing_address_collection: 'required',
  automatic_tax: { enabled: taxEnabled },
  tax_id_collection: { enabled: true },
});

// --- Selección de la suscripción "vigente" (fuente única de verdad) ---------
// Un profesional puede acumular VARIAS filas en pro_suscripciones (trial
// cancelado, luego otro plan, un upgrade que crea una suscripción de Stripe
// nueva en vez de modificar la existente, etc.). Tanto el tier calculado como
// el objeto "subscription" que ve el dashboard DEBEN salir de la MISMA regla,
// o se desincronizan (ej. tier: 'max' con subscription: la vieja de 'pro'
// cancelada, si esa fue la última CREADA pero no la vigente).

// ¿Venció por fecha aunque el estado cacheado siga diciendo trialing/active?
// (un webhook de cancelación perdido puede dejar una fila así de desactualizada)
const isSubscriptionExpired = (sub) => {
  if (sub.estado === 'trialing') {
    // Durante el trial, periodo_actual_fin en Stripe suele igualar trial_fin.
    const fin = sub.trial_fin || sub.periodo_actual_fin;
    return !!fin && new Date(fin).getTime() < Date.now();
  }
  if (sub.estado === 'active') {
    return !!sub.periodo_actual_fin && new Date(sub.periodo_actual_fin).getTime() < Date.now();
  }
  return false; // canceled/past_due/unpaid/incomplete: el estado ya lo dice, "expirado" no aplica
};

// ¿Esta fila representa acceso vigente ahora mismo?
const isSubscriptionEffective = (sub) =>
  (sub.estado === 'trialing' || sub.estado === 'active') && !isSubscriptionExpired(sub);

// Entre TODAS las filas de un profesional, cuál mostrar como "su suscripción":
// la vigente de mayor plan (mismo criterio que el tier: si hay más de una
// vigente, gana la de mayor rango, nunca la más reciente por fecha de
// creación). Si ninguna está vigente, la más recientemente actualizada — así
// se ve el último plan que tuvo, ya cancelado, no uno más viejo.
const pickDisplaySubscription = (subs) => {
  if (!subs || subs.length === 0) return null;

  const effective = subs.filter(isSubscriptionEffective);
  if (effective.length > 0) {
    return effective.reduce((best, s) =>
      (TIER_RANK[s.plan] ?? 0) > (TIER_RANK[best.plan] ?? 0) ? s : best
    );
  }

  return [...subs].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
};

export {
  PLANS,
  PERIODOS,
  buildBillingMaps,
  resolveByPriceId,
  resolvePriceId,
  isValidPlanPeriodo,
  mapStripeStatus,
  tierForStatus,
  periodoFromInterval,
  buildCheckoutTaxParams,
  isSubscriptionExpired,
  isSubscriptionEffective,
  pickDisplaySubscription,
};
