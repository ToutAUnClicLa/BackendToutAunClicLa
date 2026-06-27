// =============================================================================
// MÓDULO PRO — Controlador de facturación
// POST /me/checkout  → crea sesión de Stripe Checkout (suscripción, trial 7d)
// GET  /me/subscription → estado actual (lo consume el dashboard)
// =============================================================================
import stripe from '../config/stripe.js';
import { FRONTEND_URL, STRIPE_TAX_ENABLED } from '../config/env.js';
import { isValidPlanPeriodo } from '../services/proBillingLogic.js';
import {
  getPriceId,
  getOrCreateCustomer,
  getSubscriptionRow,
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

    const priceId = getPriceId(plan, periodo);
    if (!priceId) {
      return res.status(500).json({
        error: 'Price not configured',
        message: `Falta el Price ID para ${plan}/${periodo} en las variables de entorno`,
      });
    }

    const customerId = await getOrCreateCustomer(req.proUser);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Trial de 7 días con tarjeta requerida desde el inicio
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { pro_id: req.proUser.id, plan, periodo },
      },
      // Stripe Tax (GST/QST) — controlado por env, off hasta tener registros
      automatic_tax: { enabled: STRIPE_TAX_ENABLED },
      success_url: success_url || `${FRONTEND_URL}/dashboard?checkout=success`,
      cancel_url: cancel_url || `${FRONTEND_URL}/pricing?checkout=cancel`,
      metadata: { pro_id: req.proUser.id, plan, periodo },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('❌ Pro createCheckout error:', error);
    return res.status(500).json({ error: 'Checkout failed', message: error.message });
  }
};

// === GET /me/subscription ====================================================
const getSubscription = async (req, res) => {
  try {
    const tier = await getEffectiveTier(req.proUser);
    const sub = await getSubscriptionRow(req.proUser.id);

    return res.json({
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
    });
  } catch (error) {
    console.error('❌ Pro getSubscription error:', error);
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
};

export { createCheckout, getSubscription };
