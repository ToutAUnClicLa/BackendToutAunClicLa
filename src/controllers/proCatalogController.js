// =============================================================================
// MÓDULO PRO — Controlador de catálogo (público)
// =============================================================================
import { listCategorias } from '../services/proCatalogService.js';

// GET /api/v1/pro/categories — categorías + subcategorías trilingües
const getCategorias = async (req, res) => {
  try {
    const categorias = await listCategorias();
    return res.json({ categorias });
  } catch (error) {
    console.error('❌ Pro getCategorias error:', error);
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
};

export { getCategorias };
