// Unit — validación de eventos + hash de IP + stats (sin DB)
import {
  EVENTOS_VALIDOS,
  isValidEvento,
  hashIp as hashIpPure,
  parseDevice,
  buildWeeklyBuckets,
  buildStatsResponse,
} from '../../src/services/proAnalyticsLogic.js';
const hashIp = (ip) => hashIpPure(ip, 'test-secret');

describe('proAnalytics.isValidEvento', () => {
  it('acepta eventos conocidos', () => {
    for (const e of ['vista_perfil', 'clic_red', 'descarga_vcard', 'scan_qr', 'add_wallet']) {
      expect(isValidEvento(e)).toBe(true);
    }
  });
  it('rechaza desconocidos', () => {
    expect(isValidEvento('hack')).toBe(false);
    expect(isValidEvento('')).toBe(false);
    expect(isValidEvento(null)).toBe(false);
  });
  it('EVENTOS_VALIDOS es un Set', () => {
    expect(EVENTOS_VALIDOS.has('vista_perfil')).toBe(true);
  });
});

describe('proAnalytics.hashIp', () => {
  it('null si no hay ip', () => expect(hashIp(null)).toBeNull());
  it('devuelve string de 32 chars determinista', () => {
    const a = hashIp('1.2.3.4');
    const b = hashIp('1.2.3.4');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
  it('IPs distintas -> hashes distintos', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'));
  });
});

describe('proAnalytics.parseDevice', () => {
  it('detecta iOS', () => {
    expect(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iOS');
    expect(parseDevice('Mozilla/5.0 (iPad; CPU OS 16_0)')).toBe('iOS');
  });
  it('detecta Android', () => {
    expect(parseDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android');
  });
  it('Desktop por defecto', () => {
    expect(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Desktop');
  });
  it('Unknown si no hay UA', () => {
    expect(parseDevice(null)).toBe('Unknown');
    expect(parseDevice('')).toBe('Unknown');
  });
});

describe('proAnalytics.buildStatsResponse', () => {
  const today = new Date().toISOString();

  const makeRow = (evento, opts = {}) => ({
    evento,
    metadata: opts.fuente ? { fuente: opts.fuente } : {},
    user_agent: opts.ua || null,
    created_at: opts.date || today,
  });

  it('totales correctos para rows mixtos', () => {
    const rows = [
      makeRow('vista_perfil'),
      makeRow('vista_perfil'),
      makeRow('clic_red'),
      makeRow('descarga_vcard'),
      makeRow('scan_qr'),
    ];
    const { totals } = buildStatsResponse(rows, 'pro');
    expect(totals.vistas).toBe(2);
    expect(totals.clics_redes).toBe(1);
    expect(totals.descargas_vcard).toBe(1);
    expect(totals.scans_qr).toBe(1);
  });

  it('weekly tiene 7 buckets', () => {
    const { weekly } = buildStatsResponse([], 'pro');
    expect(weekly).toHaveLength(7);
  });

  it('Pro no expone sources ni devices', () => {
    const result = buildStatsResponse([makeRow('vista_perfil')], 'pro');
    expect(result.sources).toBeUndefined();
    expect(result.devices).toBeUndefined();
  });

  it('Max expone sources y devices', () => {
    const rows = [
      makeRow('vista_perfil', { fuente: 'directorio', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17)' }),
      makeRow('clic_red', { fuente: 'qr', ua: 'Mozilla/5.0 (Linux; Android 14)' }),
    ];
    const result = buildStatsResponse(rows, 'max');
    expect(result.sources).toBeDefined();
    expect(result.devices).toBeDefined();
    expect(result.sources.find((s) => s.fuente === 'directorio').count).toBe(1);
    expect(result.devices.find((d) => d.tipo === 'iOS').count).toBe(1);
  });

  it('clic_telefono y clic_web cuentan como clics_redes', () => {
    const rows = [makeRow('clic_telefono'), makeRow('clic_web')];
    const { totals } = buildStatsResponse(rows, 'pro');
    expect(totals.clics_redes).toBe(2);
  });

  it('array vacío devuelve ceros', () => {
    const { totals } = buildStatsResponse([], 'pro');
    expect(totals.vistas).toBe(0);
    expect(totals.clics_redes).toBe(0);
  });
});
