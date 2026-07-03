// Unit — lógica pura del vCard (sin DB)
import { escapeVcard, foldLine, buildVcard } from '../../src/services/proVcardLogic.js';

describe('escapeVcard', () => {
  it('escapa ; , \\ y saltos de línea', () => {
    expect(escapeVcard('a;b,c\\d')).toBe('a\\;b\\,c\\\\d');
    expect(escapeVcard('linea1\nlinea2')).toBe('linea1\\nlinea2');
  });
  it('null/undefined -> cadena vacía', () => {
    expect(escapeVcard(null)).toBe('');
    expect(escapeVcard(undefined)).toBe('');
  });
});

describe('foldLine', () => {
  it('no toca líneas cortas', () => {
    expect(foldLine('ABC')).toBe('ABC');
  });
  it('parte líneas > 75 con CRLF + espacio', () => {
    const long = 'X'.repeat(200);
    const folded = foldLine(long);
    expect(folded).toContain('\r\n ');
    // Sin los CRLF+espacio, debe reconstruir el original
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});

describe('buildVcard', () => {
  const base = {
    nombre: 'Zenen',
    apellido: 'Contreras',
    titulo: 'Ingénieur',
    empresa: 'UmbraGO',
    telefono: '+15145550142',
    email: 'z@x.com',
    sitio_web: 'https://x.com',
    redes: [{ plataforma: 'instagram', url: 'https://ig.com/z' }],
  };

  it('tiene envoltura y versión 3.0', () => {
    const v = buildVcard(base);
    expect(v.startsWith('BEGIN:VCARD')).toBe(true);
    expect(v).toContain('VERSION:3.0');
    expect(v.trimEnd().endsWith('END:VCARD')).toBe(true);
  });

  it('incluye FN, N, ORG, TITLE, TEL, EMAIL, URL', () => {
    const v = buildVcard(base);
    expect(v).toContain('FN:Zenen Contreras');
    expect(v).toContain('N:Contreras;Zenen;;;');
    expect(v).toContain('ORG:UmbraGO');
    expect(v).toContain('TITLE:Ingénieur');
    expect(v).toContain('TEL;TYPE=CELL:+15145550142');
    expect(v).toContain('EMAIL;TYPE=INTERNET:z@x.com');
    expect(v).toContain('URL:https://x.com');
  });

  it('incluye redes como X-SOCIALPROFILE', () => {
    const v = buildVcard(base);
    expect(v).toContain('X-SOCIALPROFILE;TYPE=instagram:https://ig.com/z');
  });

  it('omite campos ausentes', () => {
    const v = buildVcard({ nombre: 'Solo', apellido: '' });
    expect(v).toContain('FN:Solo');
    expect(v).not.toContain('ORG:');
    expect(v).not.toContain('TEL');
    expect(v).not.toContain('PHOTO');
  });

  it('incrusta foto base64 con tipo correcto', () => {
    const v = buildVcard({ ...base, fotoBase64: 'QUJD', fotoMime: 'image/png' });
    expect(v).toContain('PHOTO;ENCODING=b;TYPE=PNG:');
    const vJpg = buildVcard({ ...base, fotoBase64: 'QUJD', fotoMime: 'image/jpeg' });
    expect(vJpg).toContain('PHOTO;ENCODING=b;TYPE=JPEG:');
  });

  it('usa CRLF entre líneas', () => {
    expect(buildVcard(base)).toContain('\r\n');
  });
});
