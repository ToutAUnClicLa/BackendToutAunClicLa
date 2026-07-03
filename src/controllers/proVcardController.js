// =============================================================================
// MÓDULO PRO — Controlador vCard + QR
// GET /api/v1/pro/:slug/vcard → descarga .vcf (registra descarga_vcard)
// GET /api/v1/pro/:slug/qr    → PNG del QR hacia la tarjeta pública
// =============================================================================
import { generateVcard, generateQrPng } from '../services/proVcardService.js';
import { findProIdBySlug, logEvento } from '../services/proAnalyticsService.js';

const getVcard = async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await generateVcard(slug);
    if (!result) {
      return res.status(404).json({ error: 'Not found', message: 'Perfil no encontrado' });
    }

    // Analytics server-side (fiable, incluye descargas directas)
    logEvento({
      profesional_id: result.pro.id,
      evento: 'descarga_vcard',
      ip: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'],
    }).catch((e) => console.error('⚠️ vcard analytics:', e.message));

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.vcf"`);
    return res.send(result.vcf);
  } catch (error) {
    console.error('❌ Pro getVcard error:', error);
    return res.status(500).json({ error: 'vCard failed', message: error.message });
  }
};

const getQr = async (req, res) => {
  try {
    const { slug } = req.params;
    const proId = await findProIdBySlug(slug);
    if (!proId) {
      return res.status(404).json({ error: 'Not found', message: 'Perfil no encontrado' });
    }

    const png = await generateQrPng(slug);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h
    // Recurso público embebible desde otros dominios (p.ej. frontend en distinto host).
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(png);
  } catch (error) {
    console.error('❌ Pro getQr error:', error);
    return res.status(500).json({ error: 'QR failed', message: error.message });
  }
};

export { getVcard, getQr };
