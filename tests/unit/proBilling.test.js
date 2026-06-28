// Unit — lógica pura de facturación (sin Stripe)
import {
  buildBillingMaps,
  resolveByPriceId,
  resolvePriceId,
  isValidPlanPeriodo,
  mapStripeStatus,
  tierForStatus,
  periodoFromInterval,
} from '../../src/services/proBillingLogic.js';

const maps = buildBillingMaps({
  proMensual: 'price_pm',
  proAnual: 'price_pa',
  maxMensual: 'price_mm',
  maxAnual: 'price_ma',
});

describe('proBillingLogic.resolveByPriceId', () => {
  it('price -> {plan, periodo}', () => {
    expect(resolveByPriceId('price_pm', maps)).toEqual({ plan: 'pro', periodo: 'mensual' });
    expect(resolveByPriceId('price_ma', maps)).toEqual({ plan: 'max', periodo: 'anual' });
  });
  it('price desconocido -> null', () => {
    expect(resolveByPriceId('price_xxx', maps)).toBeNull();
  });
});

describe('proBillingLogic.resolvePriceId', () => {
  it('(plan, periodo) -> price', () => {
    expect(resolvePriceId('pro', 'mensual', maps)).toBe('price_pm');
    expect(resolvePriceId('max', 'anual', maps)).toBe('price_ma');
  });
  it('combinación inexistente -> null', () => {
    expect(resolvePriceId('pro', 'semanal', maps)).toBeNull();
  });
});

describe('proBillingLogic.isValidPlanPeriodo', () => {
  it('válidos', () => {
    expect(isValidPlanPeriodo('pro', 'mensual')).toBe(true);
    expect(isValidPlanPeriodo('max', 'anual')).toBe(true);
  });
  it('inválidos', () => {
    expect(isValidPlanPeriodo('free', 'mensual')).toBe(false);
    expect(isValidPlanPeriodo('pro', 'diario')).toBe(false);
  });
});

describe('proBillingLogic.buildBillingMaps', () => {
  it('omite price IDs faltantes sin romper', () => {
    const partial = buildBillingMaps({ proMensual: 'price_pm' });
    expect(resolvePriceId('pro', 'mensual', partial)).toBe('price_pm');
    expect(resolvePriceId('max', 'anual', partial)).toBeNull();
  });
});

describe('proBillingLogic.mapStripeStatus', () => {
  it('mapea estados conocidos', () => {
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('incomplete_expired')).toBe('canceled');
    expect(mapStripeStatus('paused')).toBe('past_due');
  });
  it('estado desconocido -> incomplete', () => expect(mapStripeStatus('zzz')).toBe('incomplete'));
});

describe('proBillingLogic.tierForStatus (gracia)', () => {
  it('active/trialing aplican el plan', () => {
    expect(tierForStatus('active', 'pro')).toBe('pro');
    expect(tierForStatus('trialing', 'max')).toBe('max');
  });
  it('canceled/unpaid -> free', () => {
    expect(tierForStatus('canceled', 'pro')).toBe('free');
    expect(tierForStatus('unpaid', 'max')).toBe('free');
  });
  it('past_due/incomplete -> null (no tocar, gracia)', () => {
    expect(tierForStatus('past_due', 'pro')).toBeNull();
    expect(tierForStatus('incomplete', 'pro')).toBeNull();
  });
});

describe('proBillingLogic.periodoFromInterval', () => {
  it('year -> anual, month -> mensual', () => {
    expect(periodoFromInterval('year')).toBe('anual');
    expect(periodoFromInterval('month')).toBe('mensual');
  });
});
