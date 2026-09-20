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
  pickDisplaySubscription,
  isUnusableStripeCustomer,
  isSubscriptionEffective,
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
// Si el ID guardado ya no existe en Stripe (otro entorno / customer borrado),
// crea uno nuevo y persiste — igual que el checkout de tienda.
const getOrCreateCustomer = async (pro) => {
  if (pro.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(pro.stripe_customer_id);
      if (!isUnusableStripeCustomer(existing, null)) return pro.stripe_customer_id;
    } catch (err) {
      if (!isUnusableStripeCustomer(null, err)) throw err;
    }
  }

  const customer = await stripe.customers.create({
    email: pro.email,
    name: `${pro.nombre} ${pro.apellido || ''}`.trim(),
    metadata: { pro_id: pro.id },
  });

  await updatePro(pro.id, { stripe_customer_id: customer.id });
  pro.stripe_customer_id = customer.id;
  return customer.id;
};

// Suscripción a mostrar del profesional (la mantiene el webhook). Un
// profesional puede tener VARIAS filas (trial cancelado, luego otro plan, un
// upgrade que creó una suscripción de Stripe nueva en vez de modificar la
// existente...) — pickDisplaySubscription elige la vigente de mayor plan, la
// MISMA regla que usa computeLiveTier, para que tier y subscription nunca se
// desincronicen. NO ordenar por created_at: la más reciente por creación
// puede no ser la vigente (ver proBillingLogic.js).
const getSubscriptionRow = async (profesionalId) => {
  const { data } = await supabaseAdmin
    .from('pro_suscripciones')
    .select('*')
    .eq('profesional_id', profesionalId);
  return pickDisplaySubscription(data || []);
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

const httpError = (status, code, message) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

// Cambia plan/periodo sobre la suscripción Stripe vigente (misma sub, prorrateo).
// plan=free → cancel_at_period_end, sin borrar el trial/periodo en curso.
const changeSubscriptionPlan = async (pro, plan, periodo) => {
  const row = await getSubscriptionRow(pro.id);
  if (!row?.stripe_subscription_id || !isSubscriptionEffective(row)) {
    throw httpError(400, 'No active subscription', 'No tienes una suscripción activa que cambiar.');
  }

  const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
  if (!['active', 'trialing'].includes(stripeSub.status)) {
    throw httpError(409, 'Subscription not changeable', 'La suscripción no se puede cambiar en este estado.');
  }

  let updated;
  if (plan === 'free') {
    updated = await stripe.subscriptions.update(stripeSub.id, { cancel_at_period_end: true });
  } else {
    const priceId = getPriceId(plan, periodo);
    if (!priceId) {
      throw httpError(500, 'Price not configured', `Falta el Price ID para ${plan}/${periodo}`);
    }
    const itemId = stripeSub.items?.data?.[0]?.id;
    if (!itemId) {
      throw httpError(500, 'Missing item', 'La suscripción de Stripe no tiene ítems.');
    }
    if (stripeSub.items.data[0].price?.id === priceId) {
      throw httpError(409, 'Already on plan', 'Ya estás en ese plan.');
    }
    updated = await stripe.subscriptions.update(stripeSub.id, {
      items: [{ id: itemId, price: priceId }],
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      metadata: { ...stripeSub.metadata, pro_id: stripeSub.metadata?.pro_id || pro.id, plan, periodo },
    });
  }

  await syncSubscription(updated);
  const sub = await getSubscriptionRow(pro.id);
  const tier = await computeLiveTier(pro.id);
  return {
    tier,
    subscription: sub
      ? {
          plan: sub.plan,
          periodo: sub.periodo,
          estado: sub.estado,
          trial_fin: sub.trial_fin,
          periodo_actual_fin: sub.periodo_actual_fin,
          cancelar_al_final: sub.cancelar_al_final,
        }
      : null,
  };
};

export {
  BILLING_MAPS,
  getPriceId,
  getPlanFromPriceId,
  getOrCreateCustomer,
  getSubscriptionRow,
  syncSubscription,
  syncCustomerSubscription,
  changeSubscriptionPlan,
  markSubscriptionDeleted,
  markPaymentFailed,
};
