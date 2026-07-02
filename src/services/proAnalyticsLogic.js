// =============================================================================
// MÓDULO PRO — Lógica pura de analytics (SIN IO, sin env)
// Testeable sin DB/env. La versión con IO vive en proAnalyticsService.js.
// =============================================================================
import crypto from 'crypto';

const EVENTOS_VALIDOS = new Set([
  'vista_perfil',
  'clic_red',
  'descarga_vcard',
  'scan_qr',
  'add_wallet',
  'clic_telefono',
  'clic_web',
]);

const isValidEvento = (evento) => EVENTOS_VALIDOS.has(evento);

// IP hasheada con un secreto -> irreversible, determinista, rotable.
const hashIp = (ip, secret) => {
  if (!ip) return null;
  return crypto.createHmac('sha256', secret || 'pro').update(String(ip)).digest('hex').slice(0, 32);
};

export { EVENTOS_VALIDOS, isValidEvento, hashIp };
