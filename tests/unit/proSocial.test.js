// Unit — lógica pura de límites de redes sociales (sin DB)
import { SOCIAL_LIMITS, canAddSocial } from '../../src/services/proSocialLogic.js';

describe('proSocialLogic.SOCIAL_LIMITS', () => {
  it('free=0, pro=5, max=∞', () => {
    expect(SOCIAL_LIMITS.free).toBe(0);
    expect(SOCIAL_LIMITS.pro).toBe(5);
    expect(SOCIAL_LIMITS.max).toBe(Infinity);
  });
});

describe('proSocialLogic.canAddSocial', () => {
  it('free no puede agregar ninguna', () => expect(canAddSocial('free', 0)).toBe(false));

  it('pro puede hasta 5 (no la 6ª)', () => {
    expect(canAddSocial('pro', 0)).toBe(true);
    expect(canAddSocial('pro', 4)).toBe(true);
    expect(canAddSocial('pro', 5)).toBe(false);
  });

  it('max es ilimitado', () => {
    expect(canAddSocial('max', 0)).toBe(true);
    expect(canAddSocial('max', 999)).toBe(true);
  });

  it('tier desconocido = 0 permitidas', () => expect(canAddSocial('xyz', 0)).toBe(false));
});
