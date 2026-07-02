// =============================================================================
// MÓDULO PRO — Controlador del directorio público (/services)
// =============================================================================
import { listDirectorio } from '../services/proDirectorioService.js';

const LANGS = new Set(['fr', 'en', 'es']);

const getServices = async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category).trim() : null;
    const subcategory = req.query.subcategory ? String(req.query.subcategory).trim() : null;
    const idioma = req.query.idioma ? String(req.query.idioma).trim().toLowerCase() : null;
    const ciudad = req.query.ciudad ? String(req.query.ciudad).trim() : null;
    const q = req.query.q ? String(req.query.q).trim() : null;
    const langRaw = req.query.lang ? String(req.query.lang).trim().toLowerCase() : 'fr';
    const lang = LANGS.has(langRaw) ? langRaw : 'fr';
    const page = Number.parseInt(req.query.page, 10) || 1;
    const pageSize = Number.parseInt(req.query.pageSize, 10) || 20;

    const result = await listDirectorio({
      category, subcategory, idioma, ciudad, q, lang, page, pageSize,
    });

    return res.json(result);
  } catch (error) {
    console.error('❌ Pro getServices error:', error);
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
};

export { getServices };
