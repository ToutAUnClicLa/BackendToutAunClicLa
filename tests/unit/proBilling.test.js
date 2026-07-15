// Unit — lógica pura de facturación (sin Stripe)
import {
  buildBillingMaps,
  resolveByPriceId,
  resolvePriceId,
  isValidPlanPeriodo,
  mapStripeStatus,
  tierForStatus,
  periodoFromInterval,
  buildCheckoutTaxParams,
  isSubscriptionExpired,
  isSubscriptionEffective,
  pickDisplaySubscription,
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

describe('proBillingLogic.buildCheckoutTaxParams (GST/QST Quebec)', () => {
  it('siempre incluye billing_address_collection y tax_id_collection', () => {
    const params = buildCheckoutTaxParams(false);
    expect(params.billing_address_collection).toBe('required');
    expect(params.tax_id_collection).toEqual({ enabled: true });
  });

  it('automatic_tax.enabled refleja la flag', () => {
    expect(buildCheckoutTaxParams(true).automatic_tax.enabled).toBe(true);
    expect(buildCheckoutTaxParams(false).automatic_tax.enabled).toBe(false);
  });

  it('estructura completa con 3 campos', () => {
    const params = buildCheckoutTaxParams(true);
    expect(Object.keys(params)).toEqual([
      'billing_address_collection',
      'automatic_tax',
      'tax_id_collection',
    ]);
  });
});

describe('proBillingLogic.isSubscriptionExpired', () => {
  it('trialing con trial_fin en el pasado -> expirada', () => {
    expect(isSubscriptionExpired({ estado: 'trialing', trial_fin: '2000-01-01T00:00:00Z' })).toBe(true);
  });
  it('trialing con trial_fin en el futuro -> no expirada', () => {
    expect(isSubscriptionExpired({ estado: 'trialing', trial_fin: '2999-01-01T00:00:00Z' })).toBe(false);
  });
  it('active con periodo_actual_fin en el pasado -> expirada', () => {
    expect(isSubscriptionExpired({ estado: 'active', periodo_actual_fin: '2000-01-01T00:00:00Z' })).toBe(true);
  });
  it('canceled/past_due/unpaid -> nunca "expirada" (el estado ya lo dice)', () => {
    expect(isSubscriptionExpired({ estado: 'canceled', periodo_actual_fin: '2000-01-01T00:00:00Z' })).toBe(false);
    expect(isSubscriptionExpired({ estado: 'past_due', periodo_actual_fin: '2000-01-01T00:00:00Z' })).toBe(false);
  });
  it('sin fecha -> no expirada (no se puede afirmar que venció)', () => {
    expect(isSubscriptionExpired({ estado: 'active', periodo_actual_fin: null })).toBe(false);
  });
});

describe('proBillingLogic.isSubscriptionEffective', () => {
  it('trialing/active sin vencer -> vigente', () => {
    expect(isSubscriptionEffective({ estado: 'trialing', trial_fin: '2999-01-01T00:00:00Z' })).toBe(true);
    expect(isSubscriptionEffective({ estado: 'active', periodo_actual_fin: '2999-01-01T00:00:00Z' })).toBe(true);
  });
  it('canceled -> nunca vigente aunque la fecha no haya pasado', () => {
    expect(isSubscriptionEffective({ estado: 'canceled', periodo_actual_fin: '2999-01-01T00:00:00Z' })).toBe(false);
  });
  it('active vencida por fecha -> no vigente', () => {
    expect(isSubscriptionEffective({ estado: 'active', periodo_actual_fin: '2000-01-01T00:00:00Z' })).toBe(false);
  });
});

describe('proBillingLogic.pickDisplaySubscription', () => {
  it('sin filas -> null', () => {
    expect(pickDisplaySubscription([])).toBeNull();
    expect(pickDisplaySubscription(null)).toBeNull();
  });

  // Reproduce el bug reportado: una suscripción MAX activa creada ANTES que
  // una suscripción PRO ya cancelada. La fila "más reciente por created_at"
  // es la cancelada — pickDisplaySubscription debe ignorar el orden de
  // creación y devolver la vigente de mayor plan (MAX), no la cancelada.
  it('con una vigente y una cancelada más reciente, gana la vigente (nunca la más nueva por creación)', () => {
    const maxActiva = {
      plan: 'max', estado: 'active', periodo_actual_fin: '2999-01-01T00:00:00Z',
      created_at: '2026-06-30T15:08:18.000Z', updated_at: '2026-07-15T15:22:46.000Z',
    };
    const proCancelada = {
      plan: 'pro', estado: 'canceled', periodo_actual_fin: '2026-07-07T14:47:50.000Z',
      created_at: '2026-07-13T19:24:32.000Z', updated_at: '2026-07-15T15:22:45.000Z',
    };
    // Orden de entrada no debería importar
    expect(pickDisplaySubscription([maxActiva, proCancelada])).toBe(maxActiva);
    expect(pickDisplaySubscription([proCancelada, maxActiva])).toBe(maxActiva);
  });

  it('dos vigentes -> gana la de mayor plan', () => {
    const pro = { plan: 'pro', estado: 'active', periodo_actual_fin: '2999-01-01T00:00:00Z' };
    const max = { plan: 'max', estado: 'trialing', trial_fin: '2999-01-01T00:00:00Z' };
    expect(pickDisplaySubscription([pro, max])).toBe(max);
  });

  it('ninguna vigente -> la más recientemente actualizada (no la más nueva por creación)', () => {
    const viejaCancelada = {
      plan: 'pro', estado: 'canceled',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
    };
    const nuevaCanceladaPeroActualizadaAntes = {
      plan: 'max', estado: 'canceled',
      created_at: '2026-06-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };
    expect(pickDisplaySubscription([viejaCancelada, nuevaCanceladaPeroActualizadaAntes])).toBe(viejaCancelada);
  });
});
