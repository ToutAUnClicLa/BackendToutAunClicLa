// =============================================================================
// MÓDULO PRO — Controlador de analytics público
// POST /api/v1/pro/analytics — registra un evento del perfil público.
// Responde rápido (fire-and-forget desde el cliente).
// =============================================================================
import { isValidEvento, findProIdBySlug, logEvento } from '../services/proAnalyticsService.js';

const trackEvento = async (req, res) => {
  try {
    const { evento, slug, metadata } = req.body || {};

    if (!isValidEvento(evento)) {
      return res.status(400).json({ error: 'Invalid event', message: 'Evento no válido' });
    }
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Missing slug', message: 'slug requerido' });
    }

    const profesional_id = await findProIdBySlug(slug);
    if (!profesional_id) {
      // No revelamos si el slug existe; respondemos 204 silencioso.
      return res.status(204).end();
    }

    // No bloqueamos la respuesta si la escritura tarda.
    logEvento({
      profesional_id,
      evento,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      ip: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'],
    }).catch((e) => console.error('⚠️ pro analytics: fallo al loguear:', e.message));

    return res.status(204).end();
  } catch (error) {
    console.error('❌ Pro trackEvento error:', error);
    return res.status(500).json({ error: 'Track failed', message: error.message });
  }
};

export { trackEvento };
