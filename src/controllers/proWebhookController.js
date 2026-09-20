// =============================================================================
// MÓDULO PRO — Webhook de Stripe
// Recibe el body RAW (montado antes de express.json en server.js), verifica la
// firma con STRIPE_PRO_WEBHOOK_SECRET y sincroniza pro_suscripciones + tier.
// Path: POST /api/v1/pro/webhook — distinto de /api/v1/stripe/webhook (tienda).
// Local: `stripe listen --forward-to localhost:5500/api/v1/pro/webhook` en un
// proceso aparte; el listen de la tienda no reenvía aquí.
// =============================================================================
import stripe from '../config/stripe.js';
import { STRIPE_PRO_WEBHOOK_SECRET } from '../config/env.js';
import {
  syncSubscription,
  markSubscriptionDeleted,
  markPaymentFailed,
} from '../services/proBillingService.js';

const handleProWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!STRIPE_PRO_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_PRO_WEBHOOK_SECRET no configurado');
    return res.status(500).send('Webhook secret not configured');
  }
  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_PRO_WEBHOOK_SECRET);
  } catch (err) {
    console.error('🔒 Pro webhook: firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await markSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_failed':
        await markPaymentFailed(event.data.object.subscription);
        break;

      case 'checkout.session.completed':
        // Respaldo: si llega la sesión de suscripción, sincroniza por si acaso.
        if (event.data.object.subscription) {
          const sub = await stripe.subscriptions.retrieve(event.data.object.subscription);
          await syncSubscription(sub);
        }
        break;

      default:
        // Evento no manejado — lo ignoramos silenciosamente
        break;
    }

    // 200 rápido para que Stripe no reintente
    return res.json({ received: true });
  } catch (error) {
    console.error('❌ Pro webhook: error procesando', event.type, error);
    // 500 -> Stripe reintentará (idempotencia lo hace seguro)
    return res.status(500).send('Webhook handler failed');
  }
};

export { handleProWebhook };
