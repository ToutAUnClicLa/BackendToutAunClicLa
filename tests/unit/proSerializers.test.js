// Unit — serializers puros (sin DB)
import { slugify, publicProfile, resolveLang, sanitizePro } from '../../src/services/proSerializers.js';

const base = {
  id: 'uuid-1',
  slug: 'juan-perez',
  nombre: 'Juan',
  apellido: 'Pérez',
  empresa: 'Salón X',
  email: 'secreto@x.com',
  password_hash: 'HASH',
  token_verificacion_email: '123456',
  codigo_postal: 'H3W',
  titulo_fr: 'Coiffeur',
  titulo_en: 'Stylist',
  titulo_es: 'Estilista',
  bio_fr: null,
  bio_en: 'EN bio',
  bio_es: null,
  idioma_principal: 'fr',
  idiomas_hablados: ['fr', 'es'],
  telefono: '514',
  sitio_web: 'https://x.com',
  ciudad: 'Montreal',
  categoria_id: 'cat',
  subcategoria_id: 'sub',
  tier: 'pro',
  destacado: false,
};

describe('slugify', () => {
  it('normaliza acentos y espacios', () => expect(slugify('Juan Pérez')).toBe('juan-perez'));
  it('quita caracteres especiales', () => expect(slugify('Café & Bar!!')).toBe('cafe-bar'));
});

describe('resolveLang', () => {
  it('devuelve el idioma pedido si existe', () => expect(resolveLang(base, 'titulo', 'es')).toBe('Estilista'));
  it('cae al fallback cuando el idioma pedido está vacío', () =>
    // bio_es null -> idioma_principal fr null -> primero disponible: EN bio
    expect(resolveLang(base, 'bio', 'es')).toBe('EN bio'));
});

describe('publicProfile', () => {
  it('resuelve titulo/bio al idioma del visitante', () => {
    const pub = publicProfile(base, 'en');
    expect(pub.titulo).toBe('Stylist');
    expect(pub.bio).toBe('EN bio');
  });

  it('NO expone email, password_hash, token ni codigo_postal', () => {
    const pub = publicProfile(base, 'fr');
    expect(pub.email).toBeUndefined();
    expect(pub.password_hash).toBeUndefined();
    expect(pub.token_verificacion_email).toBeUndefined();
    expect(pub.codigo_postal).toBeUndefined();
  });
});

describe('sanitizePro (vista privada)', () => {
  it('incluye campos editables pero NUNCA el hash ni el token', () => {
    const me = sanitizePro(base);
    expect(me.email).toBe('secreto@x.com'); // su propio email sí
    expect(me.titulo_es).toBe('Estilista');
    expect(me.password_hash).toBeUndefined();
    expect(me.token_verificacion_email).toBeUndefined();
  });
});
