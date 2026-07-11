// =============================================================================
// MÓDULO PRO — Analytics de perfil (IO). La lógica pura vive en proAnalyticsLogic.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';
import { EVENTOS_VALIDOS, isValidEvento, hashIp as hashIpPure, buildStatsResponse } from './proAnalyticsLogic.js';

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

// Lee los eventos de los últimos 7 días y devuelve la respuesta ya formateada.
const getStatsByPro = async (profesional_id, tier) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('pro_analytics')
    .select('evento, metadata, user_agent, created_at')
    .eq('profesional_id', profesional_id)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return buildStatsResponse(data || [], tier);
};

export { EVENTOS_VALIDOS, isValidEvento, findProIdBySlug, logEvento, hashIp, getStatsByPro };
