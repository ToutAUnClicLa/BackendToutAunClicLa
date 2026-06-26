// =============================================================================
// MÓDULO PRO — Servicio de redes sociales (IO sobre pro_redes_sociales)
// La lógica de límites por tier vive en proSocialLogic.js (testeable sin DB).
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import { SOCIAL_LIMITS, canAddSocial } from './proSocialLogic.js';

const TABLE = 'pro_redes_sociales';

const listSocial = async (profesionalId) => {
  const { data } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('profesional_id', profesionalId)
    .order('orden', { ascending: true });
  return data || [];
};

const countSocial = async (profesionalId) => {
  const { count } = await supabaseAdmin
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('profesional_id', profesionalId);
  return count || 0;
};

const findSocialById = async (id) => {
  const { data } = await supabaseAdmin.from(TABLE).select('*').eq('id', id).maybeSingle();
  return data;
};

const addSocial = async (profesionalId, { plataforma, url, orden }) => {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert([{ profesional_id: profesionalId, plataforma, url, orden: orden ?? 0 }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

const updateSocial = async (id, patch) => {
  const { data, error } = await supabaseAdmin
    .from(TABLE).update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
};

const deleteSocial = async (id) => {
  const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

export {
  SOCIAL_LIMITS,
  canAddSocial,
  listSocial,
  countSocial,
  findSocialById,
  addSocial,
  updateSocial,
  deleteSocial,
};
