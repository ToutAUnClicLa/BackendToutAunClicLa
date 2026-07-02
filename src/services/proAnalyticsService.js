// =============================================================================
// MÓDULO PRO — Analytics de perfil (IO). La lógica pura vive en proAnalyticsLogic.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';
import { EVENTOS_VALIDOS, isValidEvento, hashIp as hashIpPure } from './proAnalyticsLogic.js';

const hashIp = (ip) => hashIpPure(ip, JWT_SECRET);

const findProIdBySlug = async (slug) => {
  const { data } = await supabaseAdmin
    .from('pro_profesionales')
    .select('id')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle();
  return data?.id || null;
};

const logEvento = async ({ profesional_id, evento, metadata = {}, ip, user_agent }) => {
  await supabaseAdmin.from('pro_analytics').insert([
    {
      profesional_id,
      evento,
      metadata,
      ip_hash: hashIp(ip),
      user_agent: user_agent ? String(user_agent).slice(0, 256) : null,
    },
  ]);
};

export { EVENTOS_VALIDOS, isValidEvento, findProIdBySlug, logEvento, hashIp };
