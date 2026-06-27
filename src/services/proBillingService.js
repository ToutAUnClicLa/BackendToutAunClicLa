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
import { buildBillingMaps, resolvePriceId, resolveByPriceId } from './proBillingLogic.js';
import { updatePro } from './proService.js';

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

export {
  BILLING_MAPS,
  getPriceId,
  getPlanFromPriceId,
  getOrCreateCustomer,
  getSubscriptionRow,
};
