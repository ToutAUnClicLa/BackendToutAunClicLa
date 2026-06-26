// =============================================================================
// MÓDULO PRO — Servicio de tiers (IO)
// Fuente de verdad del tier: la suscripción activa/trialing (la escribirá el
// webhook de Stripe en la Semana 2). Mientras tanto, hace fallback a la columna
// cacheada pro_profesionales.tier, devolviendo el de MAYOR rango.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { TIER_RANK, hasTier, higherTier } from './proTierLogic.js';

// Acepta el objeto profesional (con .id y .tier) o un id suelto.
const getEffectiveTier = async (proOrId) => {
  let cachedTier = 'free';
  let proId = proOrId;

  if (proOrId && typeof proOrId === 'object') {
    cachedTier = proOrId.tier || 'free';
    proId = proOrId.id;
  }

  const { data: sub } = await supabaseAdmin
    .from('pro_suscripciones')
    .select('plan, estado')
    .eq('profesional_id', proId)
    .in('estado', ['trialing', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const subTier = sub?.plan || 'free';
  return higherTier(subTier, cachedTier);
};

export { TIER_RANK, hasTier, getEffectiveTier };
