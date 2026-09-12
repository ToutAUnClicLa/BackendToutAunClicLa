// =============================================================================
// CHECKOUT E-COMMERCE — Lógica pura (SIN IO). Testeable sin Stripe/Supabase.
// El pedido se reconstruye desde la sesión cobrada, no desde el carrito vivo.
// =============================================================================

const STRIPE_METADATA_MAX = 500;
const NON_PRODUCT_NAME_RE = /^(env[ií]o|tarifa de dep[oó]sito|shipping|deposit)/i;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const coerceProductId = (id) => {
  if (id == null || id === '') return null;
  const raw = String(id);
  return /^\d+$/.test(raw) ? Number(raw) : raw;
};

const truncateMeta = (value, max = STRIPE_METADATA_MAX) => {
  const s = String(value ?? '');
  return s.length <= max ? s : s.slice(0, max);
};

// Compacta items para metadata de Stripe (máx. 500 chars por valor).
// Si no cabe, devolvemos '' y el webhook usa los line items de Stripe.
const serializeCartSnapshot = (items = []) => {
  const payload = items
    .filter((item) => item && item.id != null && toNumber(item.q ?? item.quantity) > 0)
    .map((item) => ({
      id: item.id,
      q: toNumber(item.q ?? item.quantity),
      p: toNumber(item.p ?? item.unitPrice)
    }));
  const json = JSON.stringify(payload);
  return json.length <= STRIPE_METADATA_MAX ? json : '';
};

const parseCartSnapshot = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: coerceProductId(item?.id),
        quantity: toNumber(item?.q),
        unitPrice: toNumber(item?.p)
      }))
      .filter((item) => item.productId != null && item.quantity > 0);
  } catch {
    return [];
  }
};

const extractProductIdFromLineItem = (line = {}) => {
  const product = line.price?.product;
  const fromProduct = typeof product === 'object' && product
    ? product.metadata?.producto_id
    : null;
  return coerceProductId(
    fromProduct
    || line.price?.metadata?.producto_id
    || line.metadata?.producto_id
  );
};

const isNonProductLineItem = (line = {}) => {
  if (extractProductIdFromLineItem(line)) return false;
  const name = line.description || line.price?.product?.name || '';
  return NON_PRODUCT_NAME_RE.test(String(name).trim());
};

// Line items cobrados por Stripe → items de pedido (ignora envío/consigne).
const extractProductItemsFromStripeLineItems = (lineItems = []) => {
  const items = [];
  for (const line of lineItems) {
    if (isNonProductLineItem(line)) continue;
    const productId = extractProductIdFromLineItem(line);
    if (productId == null) continue;
    const quantity = toNumber(line.quantity);
    if (quantity <= 0) continue;
    const unitPrice = typeof line.price?.unit_amount === 'number'
      ? line.price.unit_amount / 100
      : (typeof line.amount_subtotal === 'number' ? line.amount_subtotal / 100 / quantity : 0);
    items.push({ productId, quantity, unitPrice });
  }
  return items;
};

// Stripe (lo cobrado) gana; el snapshot del metadata es respaldo.
const resolveOrderItems = ({ stripeItems = [], snapshotItems = [] } = {}) => {
  if (stripeItems.length > 0) return stripeItems;
  if (snapshotItems.length > 0) return snapshotItems;
  return [];
};

const parseCheckoutAmounts = (session = {}, fullSession = session) => {
  const metadata = session.metadata || {};
  const stripeTaxes = fullSession.total_details?.breakdown?.taxes || [];

  let tps;
  let tvq;
  if (stripeTaxes.length > 0) {
    tps = 0;
    tvq = 0;
    for (const taxLine of stripeTaxes) {
      const pct = toNumber(taxLine.rate?.percentage);
      const amount = toNumber(taxLine.amount) / 100;
      if (pct === 5) tps += amount;
      else tvq += amount;
    }
  } else {
    tps = toNumber(metadata.tps);
    tvq = toNumber(metadata.tvq);
  }

  const totalAmount = typeof fullSession.amount_total === 'number'
    ? fullSession.amount_total / 100
    : toNumber(metadata.total);

  return {
    userId: metadata.user_id || null,
    shippingAddressId: metadata.shipping_address_id || null,
    subtotal: toNumber(metadata.subtotal),
    consigne: toNumber(metadata.consigne),
    shippingCost: toNumber(metadata.shipping_cost),
    freeShipping: metadata.free_shipping === 'true',
    discount: toNumber(metadata.discount),
    couponCode: metadata.coupon_code || null,
    couponType: metadata.coupon_type || null,
    tps,
    tvq,
    totalAmount
  };
};

const parseDeliveryInfo = (metadata = {}) => ({
  metodoEntrega: metadata.metodo_entrega || 'puerta',
  notasEntrega: metadata.notas_entrega || null
});

const buildOrderNotes = ({
  deliveryInfo,
  couponCode,
  couponType,
  discount,
  shippingCost,
  envioGratisPorUmbral,
  envioGratisPorCupon
}) => {
  const notas = [];
  notas.push('--- INFORMACIÓN DE ENTREGA ---');
  notas.push(`Método: ${deliveryInfo?.metodoEntrega || 'puerta'}`);
  if (deliveryInfo?.notasEntrega) {
    notas.push(`Notas del repartidor: ${deliveryInfo.notasEntrega}`);
  }

  if (couponCode) {
    notas.push('--- INFORMACIÓN DE CUPÓN ---');
    notas.push(`Código: ${couponCode}`);
    notas.push(`Tipo: ${couponType === 'free_shipping' ? 'Envío gratis' : 'Descuento porcentual'}`);
    if (couponType === 'free_shipping') {
      notas.push(`Ahorro en envío: $${toNumber(shippingCost).toFixed(2)}`);
    } else if (toNumber(discount) > 0) {
      notas.push(`Descuento aplicado: $${toNumber(discount).toFixed(2)}`);
    }
  }

  notas.push('--- INFORMACIÓN DE ENVÍO ---');
  notas.push(`Costo de envío: $${toNumber(shippingCost).toFixed(2)}`);
  if (envioGratisPorUmbral) {
    notas.push('Envío gratis por compra mayor a $200 CAD');
  }
  if (envioGratisPorCupon) {
    notas.push('Envío gratis aplicado por cupón');
  }
  return notas.join('\n');
};

const computeShippingFlags = ({ subtotal, freeShipping, couponType }) => {
  const envioGratisPorUmbral = toNumber(subtotal) >= 200;
  const envioGratisPorCupon = !!freeShipping && couponType === 'free_shipping';
  return {
    envioGratisPorUmbral,
    envioGratisPorCupon,
    envioGratisTotal: envioGratisPorUmbral || envioGratisPorCupon
  };
};

export {
  STRIPE_METADATA_MAX,
  coerceProductId,
  truncateMeta,
  serializeCartSnapshot,
  parseCartSnapshot,
  extractProductIdFromLineItem,
  isNonProductLineItem,
  extractProductItemsFromStripeLineItems,
  resolveOrderItems,
  parseCheckoutAmounts,
  parseDeliveryInfo,
  buildOrderNotes,
  computeShippingFlags
};
