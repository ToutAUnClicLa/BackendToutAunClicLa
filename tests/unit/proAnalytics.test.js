// Unit — validación de eventos + hash de IP (sin DB)
import { EVENTOS_VALIDOS, isValidEvento, hashIp as hashIpPure } from '../../src/services/proAnalyticsLogic.js';
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
