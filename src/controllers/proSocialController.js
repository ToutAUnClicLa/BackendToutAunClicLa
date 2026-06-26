// =============================================================================
// MÓDULO PRO — Controlador de redes sociales (anidado al perfil propio)
// El límite por tier se valida con canAddSocial; la propiedad se verifica
// comparando profesional_id con req.proUser.id.
// =============================================================================
import { getEffectiveTier } from '../services/proTierService.js';
import {
  canAddSocial,
  listSocial,
  countSocial,
  findSocialById,
  addSocial,
  updateSocial,
  deleteSocial,
} from '../services/proSocialService.js';

// === GET /me/social ==========================================================
const listMine = async (req, res) => {
  try {
    const redes = await listSocial(req.proUser.id);
    return res.json({ redes });
  } catch (error) {
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
};

// === POST /me/social =========================================================
const addMine = async (req, res) => {
  try {
    // requireActiveTier ya dejó req.proTier; si no, lo calculamos
    const tier = req.proTier || (await getEffectiveTier(req.proUser));
    const count = await countSocial(req.proUser.id);

    if (!canAddSocial(tier, count)) {
      return res.status(403).json({
        error: 'Limit reached',
        message: `Tu plan ${tier} no permite agregar más redes sociales`,
        currentCount: count,
      });
    }

    const red = await addSocial(req.proUser.id, req.body);
    return res.status(201).json({ message: 'Red social agregada', red });
  } catch (error) {
    return res.status(500).json({ error: 'Add failed', message: error.message });
  }
};

// === PUT /me/social/:id ======================================================
const updateMine = async (req, res) => {
  try {
    const red = await findSocialById(req.params.id);
    if (!red || red.profesional_id !== req.proUser.id) {
      return res.status(404).json({ error: 'Not found', message: 'Red social no encontrada' });
    }

    const patch = {};
    ['plataforma', 'url', 'orden'].forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    });

    const updated = await updateSocial(red.id, patch);
    return res.json({ message: 'Red social actualizada', red: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Update failed', message: error.message });
  }
};

// === DELETE /me/social/:id ===================================================
const removeMine = async (req, res) => {
  try {
    const red = await findSocialById(req.params.id);
    if (!red || red.profesional_id !== req.proUser.id) {
      return res.status(404).json({ error: 'Not found', message: 'Red social no encontrada' });
    }

    await deleteSocial(red.id);
    return res.json({ message: 'Red social eliminada' });
  } catch (error) {
    return res.status(500).json({ error: 'Delete failed', message: error.message });
  }
};

export { listMine, addMine, updateMine, removeMine };
