// =============================================================================
// MÓDULO PRO — Controlador de facturación
// POST /me/checkout  → crea sesión de Stripe Checkout (suscripción, trial 7d)
// GET  /me/subscription → estado actual (lo consume el dashboard)
// =============================================================================
import stripe from '../config/stripe.js';
import { FRONTEND_URL, STRIPE_TAX_ENABLED } from '../config/env.js';
import {
  isValidPlanPeriodo,
  buildCheckoutTaxParams,
  isSubscriptionExpired,
  isSubscriptionEffective,
} from '../services/proBillingLogic.js';
import {
  getPriceId,
  getOrCreateCustomer,
  getSubscriptionRow,
  syncCustomerSubscription,
} from '../services/proBillingService.js';
import { getEffectiveTier } from '../services/proTierService.js';

const TRIAL_DAYS = 7;

// === POST /me/checkout =======================================================
const createCheckout = async (req, res) => {
  try {
    const { plan, periodo, success_url, cancel_url } = req.body;

    if (!isValidPlanPeriodo(plan, periodo)) {
      return res.status(400).json({ error: 'Invalid plan', message: 'plan/periodo inválidos' });
    }

    // Un profesional con suscripción vigente (trialing/active) NO debe pasar
    // por Checkout de nuevo: Stripe crearía una SEGUNDA suscripción en paralelo
    // (doble cobro) en vez de cambiar la existente. El cambio de plan/periodo
    // se hace en el Billing Portal (subscription_update ya está habilitado ahí),
    // que modifica la MISMA suscripción — nuestro sync ya resuelve el plan
    // nuevo a partir del price_id, sin importar la metadata original.
    const existingSub = await getSubscriptionRow(req.proUser.id);
    if (existingSub && isSubscriptionEffective(existingSub)) {
      return res.status(409).json({
        error: 'Subscription already active',
        message: 'Ya tienes una suscripción activa. Usa el portal de facturación para cambiar de plan.',
      });
    }

    const priceId = getPriceId(plan, periodo);
    if (!priceId) {
      return res.status(500).json({
        error: 'Price not configured',
        message: `Falta el Price ID para ${plan}/${periodo} en las variables de entorno`,
      });
    }

    const customerId = await getOrCreateCustomer(req.proUser);

    // Trial UNA sola vez por persona: si el customer ya tuvo alguna suscripción
    // (activa o cancelada), no repetimos la prueba gratis — paga de inmediato.
    // Fuente autoritativa: Stripe (robusto aunque la caché local tenga huecos).
    const prior = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });
    const eligibleForTrial = prior.data.length === 0;

    // Stripe exige trial_period_days >= 1: si no aplica, se omite el campo.
    const subscription_data = { metadata: { pro_id: req.proUser.id, plan, periodo } };
    if (eligibleForTrial) subscription_data.trial_period_days = TRIAL_DAYS;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Tarjeta requerida desde el inicio (trial solo para nuevos, ver arriba)
      payment_method_collection: 'always',
      subscription_data,
      // GST/QST Quebec: colección de dirección siempre activa; automatic_tax
      // controlado por STRIPE_TAX_ENABLED (requiere registros fiscales en Stripe).
      ...buildCheckoutTaxParams(STRIPE_TAX_ENABLED),
      success_url: success_url || `${FRONTEND_URL}/pro/dashboard?checkout=success`,
      cancel_url: cancel_url || `${FRONTEND_URL}/pro/pricing?checkout=cancel`,
      metadata: { pro_id: req.proUser.id, plan, periodo },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('❌ Pro createCheckout error:', error);
    return res.status(500).json({ error: 'Checkout failed', message: error.message });
  }
};

// Construye la respuesta de estado a partir del profesional ya cargado.
const buildSubResponse = async (profesionalId) => {
  const sub = await getSubscriptionRow(profesionalId);
  const tier = await getEffectiveTier(profesionalId);
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

// La fila local es una caché que mantiene el webhook. Si el webhook se pierde
// (típico en local sin `stripe listen`, o un evento fallido en prod), la caché
// puede quedar "trialing"/"active" con la fecha ya vencida — el profesional
// seguiría disfrutando el tier sin que Stripe lo respalde. Detecta ese caso
// para re-sincronizar contra Stripe (fuente de verdad).
const isStaleSubscription = (sub) =>
  !!sub && (sub.estado === 'trialing' || sub.estado === 'active') && isSubscriptionExpired(sub);

// === GET /me/subscription ====================================================
// Sincroniza desde Stripe (fuente de verdad) en dos casos, sin depender del
// webhook: (1) hay customer pero aún no hay fila local (webhook con retraso);
// (2) la fila local está vencida (trial/periodo caducado pero cacheado activo).
const getSubscription = async (req, res) => {
  try {
    let payload = await buildSubResponse(req.proUser.id);

    const needsSync =
      req.proUser.stripe_customer_id &&
      (!payload.subscription || isStaleSubscription(payload.subscription));

    if (needsSync) {
      try {
        await syncCustomerSubscription(req.proUser.stripe_customer_id);
        payload = await buildSubResponse(req.proUser.id);
      } catch (e) {
        console.warn('⚠️ syncCustomerSubscription falló (no bloquea):', e.message);
      }
    }
    return res.json(payload);
  } catch (error) {
    console.error('❌ Pro getSubscription error:', error);
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
};

// === POST /me/subscription/sync ==============================================
// Fuerza un sync desde Stripe. Útil tras volver del checkout / portal.
const syncSubscriptionEndpoint = async (req, res) => {
  try {
    if (req.proUser.stripe_customer_id) {
      await syncCustomerSubscription(req.proUser.stripe_customer_id);
    }
    const payload = await buildSubResponse(req.proUser.id);
    return res.json(payload);
  } catch (error) {
    console.error('❌ Pro syncSubscription error:', error);
    return res.status(500).json({ error: 'Sync failed', message: error.message });
  }
};

// === POST /me/billing-portal =================================================
const createBillingPortal = async (req, res) => {
  try {
    if (!req.proUser.stripe_customer_id) {
      return res.status(400).json({
        error: 'No customer',
        message: 'Aún no tienes una suscripción. Suscríbete primero.',
      });
    }

    const customerId = await getOrCreateCustomer(req.proUser);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      // ?billing=updated → el dashboard fuerza un sync desde Stripe al volver.
      return_url: req.body.return_url || `${FRONTEND_URL}/pro/dashboard?billing=updated`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Pro createBillingPortal error:', error);
    return res.status(500).json({ error: 'Portal failed', message: error.message });
  }
};

export {
  createCheckout,
  getSubscription,
  syncSubscriptionEndpoint,
  createBillingPortal,
};
