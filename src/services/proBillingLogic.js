// =============================================================================
// MÓDULO PRO — Lógica pura de facturación (SIN IO). Testeable sin Stripe.
// Mapea priceId ↔ { plan, periodo } a partir de un objeto de price IDs.
// =============================================================================

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
};
