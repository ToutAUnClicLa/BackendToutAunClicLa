// =============================================================================
// MÓDULO PRO — Servicio de facturación (IO: Stripe + Supabase)
// La lógica pura de mapeo vive en proBillingLogic.js.
// =============================================================================
import stripe from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import {
  STRIPE_PRICE_PRO_MENSUAL,
  STRIPE_PRICE_PRO_ANUAL,
  STRIPE_PRICE_MAX_MENSUAL,
  STRIPE_PRICE_MAX_ANUAL,
} from '../config/env.js';
import {
  buildBillingMaps,
  resolvePriceId,
  resolveByPriceId,
  mapStripeStatus,
  tierForStatus,
  periodoFromInterval,
} from './proBillingLogic.js';
import { updatePro, findProById } from './proService.js';
import { computeLiveTier } from './proTierService.js';

const unixToISO = (ts) => (ts ? new Date(ts * 1000).toISOString() : null);

// Mapas construidos UNA vez a partir de las env vars
const BILLING_MAPS = buildBillingMaps({
  proMensual: STRIPE_PRICE_PRO_MENSUAL,
  proAnual: STRIPE_PRICE_PRO_ANUAL,
  maxMensual: STRIPE_PRICE_MAX_MENSUAL,
  maxAnual: STRIPE_PRICE_MAX_ANUAL,
});

const getPriceId = (plan, periodo) => resolvePriceId(plan, periodo, BILLING_MAPS);
const getPlanFromPriceId = (priceId) => resolveByPriceId(priceId, BILLING_MAPS);

// Devuelve el stripe_customer_id del profesional; lo crea si no existe.
const getOrCreateCustomer = async (pro) => {
  if (pro.stripe_customer_id) return pro.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: pro.email,
    name: `${pro.nombre} ${pro.apellido || ''}`.trim(),
    metadata: { pro_id: pro.id },
  });

  await updatePro(pro.id, { stripe_customer_id: customer.id });
  return customer.id;
};

// Última suscripción registrada del profesional (la mantiene el webhook)
const getSubscriptionRow = async (profesionalId) => {
  const { data } = await supabaseAdmin
    .from('pro_suscripciones')
    .select('*')
    .eq('profesional_id', profesionalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
};

// Resuelve el profesional dueño de la suscripción: primero por metadata.pro_id,
// luego por stripe_customer_id (respaldo).
const findProfesionalForSubscription = async (subscription) => {
  const metaProId = subscription.metadata?.pro_id;
  if (metaProId) return metaProId;

  const { data } = await supabaseAdmin
    .from('pro_profesionales')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .maybeSingle();
  return data?.id || null;
};

// Upsert idempotente de la suscripción + sincronización de la caché tier.
// Fuente de verdad: el objeto subscription de Stripe.
const syncSubscription = async (subscription) => {
  const profesionalId = await findProfesionalForSubscription(subscription);
  if (!profesionalId) {
    console.warn('⚠️ Webhook: suscripción sin profesional asociado', subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id;
  const interval = item?.price?.recurring?.interval;

  // plan/periodo: el PRICE es la fuente de verdad. Un upgrade/downgrade por el
  // Customer Portal cambia el price pero NO nuestra metadata (que quedaría vieja,
  // p. ej. 'pro' tras subir a Max). Solo caemos a metadata si el price no está
  // en nuestro mapa de env.
  const fromPrice = getPlanFromPriceId(priceId);
  const plan = fromPrice?.plan || subscription.metadata?.plan || 'pro';
  const periodo =
    (interval ? periodoFromInterval(interval) : null) || subscription.metadata?.periodo || 'mensual';

  const estado = mapStripeStatus(subscription.status);

  const row = {
    profesional_id: profesionalId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan,
    periodo,
    estado,
    trial_fin: unixToISO(subscription.trial_end),
    periodo_actual_fin: unixToISO(subscription.current_period_end),
    cancelar_al_final: !!subscription.cancel_at_period_end,
  };

  // Idempotente: upsert por stripe_subscription_id (único)
  const { error } = await supabaseAdmin
    .from('pro_suscripciones')
    .upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;

  // Sincroniza la caché tier (null = no tocar, gracia en past_due/incomplete).
  // El valor a escribir se recalcula en vivo sobre TODAS las suscripciones del
  // profesional (no el plan de ESTA suscripción a secas): si tiene otra
  // suscripción activa/trialing, cancelar/degradar esta no debe pisarle el
  // tier vigente con 'free' — y si tiene dos activas, el tier cacheado debe
  // ser el de mayor rango entre ambas, no el de la que llegó al webhook.
  const nextTier = tierForStatus(estado, plan);
  if (nextTier) {
    const liveTier = await computeLiveTier(profesionalId);
    await updatePro(profesionalId, { tier: liveTier });
  }
};

// Suscripción eliminada -> cancela y baja a free
const markSubscriptionDeleted = async (subscription) => {
  const profesionalId = await findProfesionalForSubscription(subscription);

  await supabaseAdmin
    .from('pro_suscripciones')
    .update({ estado: 'canceled', cancelar_al_final: false })
    .eq('stripe_subscription_id', subscription.id);

  // findProById: si el profesional se eliminó (deleteMe cancela en Stripe
  // ANTES de borrar la fila), este webhook llega después con la fila ya
  // borrada — sin este check, updatePro lanza (0 filas) y Stripe reintenta
  // indefinidamente un evento que ya no tiene nada que sincronizar.
  if (profesionalId && (await findProById(profesionalId))) {
    // Igual que en syncSubscription: recalcular en vivo, no asumir 'free' — el
    // profesional puede tener otra suscripción activa/trialing.
    const liveTier = await computeLiveTier(profesionalId);
    await updatePro(profesionalId, { tier: liveTier });
  }
};

// Sincroniza TODAS las suscripciones del customer leyéndolas directo de Stripe.
// Útil al volver del checkout y para reparar filas obsoletas (un webhook perdido
// pudo dejar una vieja suscripción "trialing" cuando en Stripe ya está cancelada).
const syncCustomerSubscription = async (customerId) => {
  if (!customerId) return;
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  // De más antigua a más reciente: así la más reciente se sincroniza al final y
  // su tier queda como el vigente en la caché pro_profesionales.tier.
  for (const sub of [...subs.data].reverse()) {
    await syncSubscription(sub);
  }
};

// invoice.payment_failed -> marca past_due (sin bajar tier; gracia)
const markPaymentFailed = async (subscriptionId) => {
  if (!subscriptionId) return;
  await supabaseAdmin
    .from('pro_suscripciones')
    .update({ estado: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);
};

export {
  BILLING_MAPS,
  getPriceId,
  getPlanFromPriceId,
  getOrCreateCustomer,
  getSubscriptionRow,
  syncSubscription,
  syncCustomerSubscription,
  markSubscriptionDeleted,
  markPaymentFailed,
};
