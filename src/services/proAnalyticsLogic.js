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

// ---------------------------------------------------------------------------
// Lógica de stats (lectura del dashboard) — pura, sin IO
// ---------------------------------------------------------------------------

// 'iOS' | 'Android' | 'Desktop' desde el user_agent almacenado
const parseDevice = (ua) => {
  if (!ua) return 'Unknown';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  return 'Desktop';
};

// Genera 7 buckets diarios (UTC) para el gráfico semanal
const buildWeeklyBuckets = (rows) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.push({ date: d.toISOString().slice(0, 10), vistas: 0, clics: 0, descargas: 0, scans: 0 });
  }

  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    const b = buckets.find((x) => x.date === day);
    if (!b) continue;
    if (row.evento === 'vista_perfil') b.vistas++;
    if (row.evento === 'clic_red' || row.evento === 'clic_telefono' || row.evento === 'clic_web') b.clics++;
    if (row.evento === 'descarga_vcard') b.descargas++;
    if (row.evento === 'scan_qr') b.scans++;
  }

  return buckets;
};

// Respuesta para GET /me/analytics.
// Pro: totales + weekly. Max añade sources y devices (ciudades = V1.2, sin datos de geo).
const buildStatsResponse = (rows, tier) => {
  const totals = { vistas: 0, clics_redes: 0, descargas_vcard: 0, scans_qr: 0 };

  for (const row of rows) {
    if (row.evento === 'vista_perfil') totals.vistas++;
    if (row.evento === 'clic_red' || row.evento === 'clic_telefono' || row.evento === 'clic_web') totals.clics_redes++;
    if (row.evento === 'descarga_vcard') totals.descargas_vcard++;
    if (row.evento === 'scan_qr') totals.scans_qr++;
  }

  const weekly = buildWeeklyBuckets(rows);
  const base = { totals, weekly };

  if (tier !== 'max') return base;

  // Max: fuentes desde metadata.fuente + dispositivos desde user_agent
  const sourceCounts = {};
  const deviceCounts = {};

  for (const row of rows) {
    const fuente = row.metadata?.fuente || 'directo';
    sourceCounts[fuente] = (sourceCounts[fuente] || 0) + 1;

    const device = parseDevice(row.user_agent);
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
  }

  const sources = Object.entries(sourceCounts)
    .map(([fuente, count]) => ({ fuente, count }))
    .sort((a, b) => b.count - a.count);

  const devices = Object.entries(deviceCounts)
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count);

  return { ...base, sources, devices };
};

export { EVENTOS_VALIDOS, isValidEvento, hashIp, parseDevice, buildWeeklyBuckets, buildStatsResponse };
