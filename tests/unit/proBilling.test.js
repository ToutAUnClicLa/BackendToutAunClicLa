// Unit — lógica pura de facturación (sin Stripe)
import {
  buildBillingMaps,
  resolveByPriceId,
  resolvePriceId,
  isValidPlanPeriodo,
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
