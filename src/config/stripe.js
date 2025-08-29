import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, IS_PRODUCTION, STRIPE_MODE } from './env.js';

if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = Stripe(STRIPE_SECRET_KEY);

// Log de configuración de Stripe
console.log(`💳 Stripe initialized in ${STRIPE_MODE} mode`);
if (IS_PRODUCTION && STRIPE_MODE === 'TEST') {
  console.warn('⚠️  WARNING: Production server using Stripe TEST mode!');
  console.warn('⚠️  Webhooks may not work correctly. Configure production webhook endpoint in Stripe Dashboard.');
  console.warn('⚠️  For real payments, configure Stripe LIVE keys in production environment.');
}

export default stripe;
