// Unit — lógica pura del directorio (sin DB)
import { TIER_ORDER, rankScore, rankPros, shapeForDirectory } from '../../src/services/proDirectorioLogic.js';

const mkPro = (id, tier, opts = {}) => ({
  id,
  slug: `p-${id}`,
  nombre: `N${id}`,
  apellido: `A${id}`,
  empresa: `E${id}`,
  foto_url: `foto${id}.jpg`,
  titulo_fr: `Titre ${id}`,
  titulo_en: `Title ${id}`,
  titulo_es: `Título ${id}`,
  bio_fr: `Bio FR ${id}`,
  bio_en: `Bio EN ${id}`,
  bio_es: `Bio ES ${id}`,
  idioma_principal: 'fr',
  idiomas_hablados: ['fr', 'es'],
  ciudad: `Ville${id}`,
  categoria_id: 'cat',
  subcategoria_id: 'sub',
  tier,
  destacado: false,
  created_at: '2026-06-01T00:00:00Z',
  ...opts,
});

describe('TIER_ORDER', () => {
  it('max > pro > free', () => {
    expect(TIER_ORDER.max).toBeGreaterThan(TIER_ORDER.pro);
    expect(TIER_ORDER.pro).toBeGreaterThan(TIER_ORDER.free);
  });
});

describe('rankScore', () => {
  it('Max destacado > Max no destacado', () => {
    expect(rankScore(mkPro('a', 'max', { destacado: true })))
      .toBeGreaterThan(rankScore(mkPro('b', 'max')));
  });
  it('Max > Pro > Free', () => {
    expect(rankScore(mkPro('a', 'max'))).toBeGreaterThan(rankScore(mkPro('b', 'pro')));
    expect(rankScore(mkPro('b', 'pro'))).toBeGreaterThan(rankScore(mkPro('c', 'free')));
  });
  it('destacado en Pro no importa (solo Max)', () => {
    expect(rankScore(mkPro('a', 'pro', { destacado: true })))
      .toBe(rankScore(mkPro('b', 'pro')));
  });
});

describe('rankPros', () => {
  it('ordena Max destacado → Max → Pro → Free', () => {
    const pros = [
      mkPro('free', 'free'),
      mkPro('pro', 'pro'),
      mkPro('max', 'max'),
      mkPro('maxd', 'max', { destacado: true }),
    ];
    const ordered = rankPros(pros).map((p) => p.id);
    expect(ordered).toEqual(['maxd', 'max', 'pro', 'free']);
  });

  it('desempate por created_at descendente dentro del mismo tier', () => {
    const pros = [
      mkPro('a', 'pro', { created_at: '2026-01-01' }),
      mkPro('b', 'pro', { created_at: '2026-06-01' }),
      mkPro('c', 'pro', { created_at: '2026-03-01' }),
    ];
    expect(rankPros(pros).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('no muta el arreglo original', () => {
    const pros = [mkPro('a', 'free'), mkPro('b', 'max')];
    const before = pros.map((p) => p.id);
    rankPros(pros);
    expect(pros.map((p) => p.id)).toEqual(before);
  });
});

describe('shapeForDirectory', () => {
  it('Free devuelve solo lo básico (sin foto, sin título, sin redes)', () => {
    const p = shapeForDirectory(mkPro('a', 'free'), 'es', []);
    expect(p).toEqual({
      slug: 'p-a', nombre: 'Na', apellido: 'Aa',
      categoria_id: 'cat', subcategoria_id: 'sub', tier: 'free',
    });
    expect(p.foto_url).toBeUndefined();
    expect(p.titulo).toBeUndefined();
    expect(p.redes).toBeUndefined();
  });

  it('Pro incluye foto/título/redes (máx 3)', () => {
    const redes = [
      { plataforma: 'ig', url: 'u1' }, { plataforma: 'li', url: 'u2' },
      { plataforma: 'fb', url: 'u3' }, { plataforma: 'tk', url: 'u4' },
    ];
    const p = shapeForDirectory(mkPro('a', 'pro'), 'es', redes);
    expect(p.foto_url).toBe('fotoa.jpg');
    expect(p.titulo).toBe('Título a');
    expect(p.redes).toHaveLength(3);
    expect(p.bio).toBeUndefined();
    expect(p.destacado).toBeUndefined();
  });

  it('Max incluye bio + destacado + redes ilimitadas', () => {
    const redes = Array.from({ length: 7 }, (_, i) => ({ plataforma: `p${i}`, url: `u${i}` }));
    const p = shapeForDirectory(mkPro('a', 'max', { destacado: true }), 'en', redes);
    expect(p.bio).toBe('Bio EN a');
    expect(p.destacado).toBe(true);
    expect(p.redes).toHaveLength(7);
  });

  it('resuelve idioma con fallback al idioma_principal', () => {
    // titulo_es vacío → fallback a idioma_principal fr
    const raw = mkPro('a', 'pro', { titulo_es: null });
    const p = shapeForDirectory(raw, 'es', []);
    expect(p.titulo).toBe('Titre a');
  });
});
