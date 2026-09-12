import {
  coerceProductId,
  serializeCartSnapshot,
  parseCartSnapshot,
  extractProductItemsFromStripeLineItems,
  resolveOrderItems,
  parseCheckoutAmounts,
  parseDeliveryInfo,
  buildOrderNotes,
  computeShippingFlags,
  STRIPE_METADATA_MAX
} from '../../src/services/checkoutOrderLogic.js';

describe('coerceProductId', () => {
  it('convierte ids numéricos y deja UUIDs', () => {
    expect(coerceProductId('42')).toBe(42);
    expect(coerceProductId(42)).toBe(42);
    expect(coerceProductId('b8da9ba2-85f7-4072-91e7-77f92a3687c7'))
      .toBe('b8da9ba2-85f7-4072-91e7-77f92a3687c7');
  });
  it('null / vacío -> null', () => {
    expect(coerceProductId(null)).toBeNull();
    expect(coerceProductId('')).toBeNull();
  });
});

describe('cart snapshot metadata', () => {
  it('serializa y parsea items compactos', () => {
    const raw = serializeCartSnapshot([
      { id: 10, q: 2, p: 12.5 },
      { id: 11, quantity: 1, unitPrice: 4 }
    ]);
    expect(parseCartSnapshot(raw)).toEqual([
      { productId: 10, quantity: 2, unitPrice: 12.5 },
      { productId: 11, quantity: 1, unitPrice: 4 }
    ]);
  });

  it('si no cabe en 500 chars, no escribe snapshot', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `aaaaaaaa-bbbb-cccc-dddd-${String(i).padStart(12, '0')}`,
      q: 1,
      p: 9.99
    }));
    const raw = serializeCartSnapshot(items);
    expect(raw).toBe('');
    expect(JSON.stringify(items).length).toBeGreaterThan(STRIPE_METADATA_MAX);
  });

  it('JSON inválido -> []', () => {
    expect(parseCartSnapshot('no-json')).toEqual([]);
    expect(parseCartSnapshot('')).toEqual([]);
  });
});

describe('extractProductItemsFromStripeLineItems', () => {
  const lineItems = [
    {
      description: 'Bandeja paisa',
      quantity: 2,
      amount_subtotal: 4500,
      price: {
        unit_amount: 2250,
        product: { metadata: { producto_id: '88' }, name: 'Bandeja paisa' }
      }
    },
    {
      description: 'Envío',
      quantity: 1,
      amount_subtotal: 1700,
      price: { unit_amount: 1700, product: { name: 'Envío' } }
    },
    {
      description: 'Tarifa de Depósito',
      quantity: 1,
      amount_subtotal: 0,
      price: { unit_amount: 0, product: { name: 'Tarifa de Depósito' } }
    }
  ];

  it('solo extrae productos con producto_id (ignora envío/consigne)', () => {
    expect(extractProductItemsFromStripeLineItems(lineItems)).toEqual([
      { productId: 88, quantity: 2, unitPrice: 22.5 }
    ]);
  });

  it('sesión sin productos -> []', () => {
    expect(extractProductItemsFromStripeLineItems([lineItems[1]])).toEqual([]);
  });
});

describe('resolveOrderItems', () => {
  it('Stripe gana sobre el snapshot', () => {
    const stripeItems = [{ productId: 1, quantity: 1, unitPrice: 10 }];
    const snapshotItems = [{ productId: 2, quantity: 3, unitPrice: 5 }];
    expect(resolveOrderItems({ stripeItems, snapshotItems })).toEqual(stripeItems);
  });

  it('si Stripe no trae productos, usa snapshot (sesiones viejas / fallback)', () => {
    const snapshotItems = [{ productId: 2, quantity: 3, unitPrice: 5 }];
    expect(resolveOrderItems({ stripeItems: [], snapshotItems })).toEqual(snapshotItems);
  });

  it('sin ninguna fuente -> []', () => {
    expect(resolveOrderItems({})).toEqual([]);
  });
});

describe('parseCheckoutAmounts', () => {
  const session = {
    amount_total: 6932,
    metadata: {
      user_id: 'user-1',
      shipping_address_id: 'addr-1',
      subtotal: '45.50',
      shipping_cost: '17.00',
      consigne: '0.00',
      discount: '0.00',
      tps: '2.27',
      tvq: '4.54',
      total: '69.31',
      coupon_code: '',
      coupon_type: '',
      free_shipping: 'false'
    }
  };

  it('usa amount_total de Stripe y metadata para el resto', () => {
    const amounts = parseCheckoutAmounts(session);
    expect(amounts.userId).toBe('user-1');
    expect(amounts.totalAmount).toBe(69.32);
    expect(amounts.subtotal).toBe(45.5);
    expect(amounts.shippingCost).toBe(17);
    expect(amounts.tps).toBe(2.27);
    expect(amounts.tvq).toBe(4.54);
  });

  it('desglosa TPS/TVQ desde breakdown de Stripe si existe', () => {
    const full = {
      amount_total: 6932,
      total_details: {
        breakdown: {
          taxes: [
            { amount: 227, rate: { percentage: 5 } },
            { amount: 455, rate: { percentage: 9.975 } }
          ]
        }
      }
    };
    const amounts = parseCheckoutAmounts(session, full);
    expect(amounts.tps).toBe(2.27);
    expect(amounts.tvq).toBe(4.55);
  });
});

describe('delivery + notes', () => {
  it('parseDeliveryInfo usa metadata o puerta por defecto', () => {
    expect(parseDeliveryInfo({ metodo_entrega: 'manos', notas_entrega: 'portero' }))
      .toEqual({ metodoEntrega: 'manos', notasEntrega: 'portero' });
    expect(parseDeliveryInfo({})).toEqual({ metodoEntrega: 'puerta', notasEntrega: null });
  });

  it('computeShippingFlags respeta umbral y cupón', () => {
    expect(computeShippingFlags({ subtotal: 200, freeShipping: false, couponType: '' }))
      .toEqual({ envioGratisPorUmbral: true, envioGratisPorCupon: false, envioGratisTotal: true });
    expect(computeShippingFlags({ subtotal: 20, freeShipping: true, couponType: 'free_shipping' }))
      .toEqual({ envioGratisPorUmbral: false, envioGratisPorCupon: true, envioGratisTotal: true });
  });

  it('buildOrderNotes incluye método y envío', () => {
    const notes = buildOrderNotes({
      deliveryInfo: { metodoEntrega: 'puerta', notasEntrega: null },
      couponCode: null,
      shippingCost: 17,
      envioGratisPorUmbral: false,
      envioGratisPorCupon: false
    });
    expect(notes).toContain('Método: puerta');
    expect(notes).toContain('Costo de envío: $17.00');
  });
});
