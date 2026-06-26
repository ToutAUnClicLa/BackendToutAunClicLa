// =============================================================================
// MÓDULO PRO — Middleware de gating por tier
// requireActiveTier('pro' | 'max'). Debe ir DESPUÉS de requireProAuth
// (necesita req.proUser). Inyecta req.proTier para reutilizarlo aguas abajo.
// =============================================================================
import { getEffectiveTier, hasTier } from '../services/proTierService.js';

const requireActiveTier = (min) => async (req, res, next) => {
  try {
    const tier = await getEffectiveTier(req.proUser);
    req.proTier = tier;

    if (!hasTier(tier, min)) {
      return res.status(403).json({
        error: 'Upgrade required',
        message: `Esta función requiere el plan ${min} o superior`,
        currentTier: tier,
        requiredTier: min,
      });
    }
    next();
  } catch (error) {
    console.error('requireActiveTier error:', error);
    return res.status(500).json({ error: 'Tier check failed', message: error.message });
  }
};

export { requireActiveTier };
