// Unit — lógica pura de tiers (sin DB)
import { TIER_RANK, hasTier, higherTier } from '../../src/services/proTierLogic.js';

describe('proTierLogic.hasTier', () => {
  it('free NO alcanza pro', () => expect(hasTier('free', 'pro')).toBe(false));
  it('pro alcanza pro', () => expect(hasTier('pro', 'pro')).toBe(true));
  it('max alcanza pro', () => expect(hasTier('max', 'pro')).toBe(true));
  it('pro NO alcanza max', () => expect(hasTier('pro', 'max')).toBe(false));
  it('max alcanza max', () => expect(hasTier('max', 'max')).toBe(true));
  it('tier desconocido se trata como free', () => expect(hasTier('xyz', 'pro')).toBe(false));
});

describe('proTierLogic.TIER_RANK', () => {
  it('está ordenado free < pro < max', () => {
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.pro);
    expect(TIER_RANK.pro).toBeLessThan(TIER_RANK.max);
  });
});

describe('proTierLogic.higherTier', () => {
  it('devuelve el de mayor rango', () => {
    expect(higherTier('free', 'pro')).toBe('pro');
    expect(higherTier('max', 'pro')).toBe('max');
    expect(higherTier('free', 'free')).toBe('free');
  });
});
