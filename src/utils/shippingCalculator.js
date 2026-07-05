import { supabaseAdmin } from '../config/supabase.js';
import { calculateCartTotals } from './cartHelpers.js';

// ============================================================================
// LIBRERÍA DE COSTOS DE ENVÍO POR CÓDIGO POSTAL
// ----------------------------------------------------------------------------
// El costo de domicilio depende ÚNICAMENTE del prefijo (primeros 3 caracteres)
// del código postal de la dirección principal del usuario.
// ============================================================================
const SHIPPING_COSTS_BY_POSTAL_PREFIX = {
  // --- Códigos H (Montréal y alrededores) ---
  'H1A': 40.00,
  'H1B': 28.00,
  'H1C': 40.00,
  'H1E': 32.00,
  'H1G': 32.00,
  'H1H': 30.00,
  'H1J': 30.00,
  'H1K': 27.00, 
  'H1L': 27.00,
  'H1M': 25.00,
  'H1P': 22.00,
  'H1R': 22.00,
  'H1S': 25.00,
  'H1T': 25.00,
  'H1V': 21.00,
  'H1W': 21.00,
  'H1X': 21.00,
  'H1Y': 18.00,
  'H1Z': 22.00,
  'H2A': 19.00,
  'H2B': 30.00,
  'H2C': 30.00,
  'H2E': 19.00,
  'H2G': 19.00,
  'H2H': 18.00,
  'H2J': 18.00,
  'H2K': 17.00,
  'H2L': 17.00,
  'H2M': 22.00,
  'H2P': 19.00,
  'H2R': 19.00,
  'H2S': 19.00,
  'H2T': 18.00,
  'H2V': 25.00,
  'H2W': 18.00,
  'H2X': 17.00,
  'H2Y': 17.00,
  'H2Z': 17.00,
  'H3A': 17.00,
  'H3B': 17.00,
  'H3C': 15.00,
  'H3E': 15.00, 
  'H3K': 19.00,
  'H3L': 30.00,
  'H3N': 25.00,
  'H3P': 25.00,
  'H3R': 21.00,
  'H3S': 21.00,
  'H3T': 21.00,
  'H3V': 21.00,
  'H3W': 19.00, 
  'H3Y': 21.00,
  'H3Z': 21.00,
  'H4A': 22.00,
  'H4B': 22.00,
  'H4E': 19.00,
  'H4G': 19.00,
  'H4H': 19.00,
  'H4N': 28.00,
  'H4P': 28.00,
  'H4V': 22.00,
  'H4W': 22.00,
  'H4X': 22.00,
  'H8N': 19.00,
  'H8P': 20.00,
  'H8R': 20.00,

  // --- Códigos J (Rive-Sud y ciudades aledañas) ---
  'J3E': 21.50, // Sainte-Julie
  'J3G': 26.50, // Beloeil
  'J3L': 26.50, // Chambly
  'J3V': 20.50, // Saint-Bruno-de-Montarville
  'J3X': 21.50, // Varennes
  'J3Y': 7.75,
  'J3Z': 7.75,
  'J4B': 13.50,
  'J4G': 7.00,
  'J4H': 7.00,
  'J4J': 7.00,
  'J4K': 7.00,
  'J4L': 7.00,
  'J4M': 7.00,
  'J4N': 7.00,
  'J4P': 7.75,
  'J4R': 13.50,
  'J4S': 7.75,
  'J4T': 7.75,
  'J4V': 7.75,
  'J4W': 9.00,
  'J4X': 9.00,
  'J4Y': 9.00,
  'J4Z': 9.00,
  'J5B': 14.00,
  'J5C': 26.50, // Sainte-Catherine
  'J5R': 23.50, // Candiac
  'J6A': 45.00,
  'J6V': 50.00,
  'J7A': 60.00,
  'J7B': 68.00,
  'J7E': 64.00,
  'J7G': 55.00,
  'J7H': 64.00,
  'J7P': 60.00
};

// Envío gratis cuando el subtotal de compra alcanza este monto.
const FREE_SHIPPING_THRESHOLD = 200.00;

// Mensaje cuando el código postal está fuera de la zona de cobertura.
const NOT_DELIVERABLE_MESSAGE = 'No disponible esta ubicación por el momento!';

/**
 * Normaliza un código postal a su prefijo: primeros 3 caracteres, en mayúsculas
 * y sin espacios. Ej: "j4w 2b3" -> "J4W".
 */
const getPostalPrefix = (postalCode) =>
  postalCode ? postalCode.toUpperCase().replace(/\s+/g, '').substring(0, 3) : null;

/**
 * Costo de domicilio según el código postal. Única fuente de verdad del envío.
 * Devuelve `null` si el código postal NO está en la zona de cobertura.
 */
const getShippingCostByPostalCode = (postalCode) => {
  const prefix = getPostalPrefix(postalCode);
  if (!prefix) return null;
  return SHIPPING_COSTS_BY_POSTAL_PREFIX[prefix] ?? null;
};

// ============================================================================
// PROMOCIÓN DE FIN DE SEMANA (Herencia) — envío gratis por monto y zona
// ============================================================================
const PROMO_WEEKEND_HERENCIA = {
  active: true,
  startDate: '2026-02-07',
  endDate: '2026-02-08',
  subcategories: [15, 17], // Herencia Cafe, Herencia Restrobar
  thresholds: {
    san_tuber: 25.00,
    riviera_sur: 40.00,
    montreal: 75.00
  }
};

const SAN_TUBER_PREFIXES = ['J4T', 'J4Y', 'J4Z', 'J3Y'];

const RIVIERA_SUR_PREFIXES = [
  'J3Y', 'J3Z', 'J4B', 'J4G', 'J4H', 'J4J', 'J4L', 'J4M', 'J4N',
  'J4P', 'J4R', 'J4S', 'J4T', 'J4V', 'J4W', 'J4X', 'J4Y', 'J4Z',
  'J5R', 'J3V', 'J3X', 'J3L', 'J5C', 'J3E', 'J3G'
];

/**
 * Determina la zona (san_tuber / riviera_sur / montreal) de un código postal.
 * Solo se usa para los umbrales de la promoción Herencia.
 */
const determineZoneFromPostalCode = (postalCode) => {
  const prefix = getPostalPrefix(postalCode);
  if (!prefix) return 'montreal';
  return RIVIERA_SUR_PREFIXES.includes(prefix) ? 'riviera_sur' : 'montreal';
};

const checkHerenciaWeekendPromotion = (cartItems, postalCode) => {
  // 1. Verificar fecha (hora de Montreal)
  const montrealDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Montreal' }));
  const dateString = montrealDate.toISOString().split('T')[0];

  if (dateString < PROMO_WEEKEND_HERENCIA.startDate || dateString > PROMO_WEEKEND_HERENCIA.endDate) {
    return { applied: false };
  }

  // 2. El carrito debe contener SOLO productos Herencia (subcategorías 15 o 17)
  const allItemsAreHerencia = cartItems.every(item =>
    PROMO_WEEKEND_HERENCIA.subcategories.includes(item.productos.subcategoria_id)
  );
  if (!allItemsAreHerencia) {
    return { applied: false, reason: 'Mixed cart' };
  }

  // 3. Subtotal del carrito
  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.productos.precio) * item.cantidad,
    0
  );

  // 4. Umbral según zona
  const prefix = getPostalPrefix(postalCode);
  let zone = 'montreal';
  if (prefix && SAN_TUBER_PREFIXES.includes(prefix)) {
    zone = 'san_tuber';
  } else if (determineZoneFromPostalCode(postalCode) === 'riviera_sur') {
    zone = 'riviera_sur';
  }

  const threshold = PROMO_WEEKEND_HERENCIA.thresholds[zone];
  if (subtotal >= threshold) {
    return { applied: true, cost: 0, zone };
  }
  return { applied: false, reason: 'Threshold not met', subtotal, threshold, zone };
};

// ============================================================================
// CÁLCULO DE ENVÍO
// ----------------------------------------------------------------------------
// Reglas (en orden):
//   0. Si el código postal NO está en la zona de cobertura -> NO entregable.
//   1. Promoción Herencia activa y elegible -> envío gratis.
//   2. Subtotal >= FREE_SHIPPING_THRESHOLD -> envío gratis.
//   3. En cualquier otro caso, costo = tabla por código postal.
// Los cupones de envío gratis se aplican aparte (applyCouponToCart) y ponen el
// costo final en 0, por lo que aquí no se manejan.
// ============================================================================

/**
 * Lógica principal: calcula el costo de envío para una dirección concreta.
 * Devuelve `deliverable: false` cuando el código postal está fuera de zona.
 */
export const calculateShippingCostAdvanced = async (userId, cartItems, shippingAddress) => {
  const herenciaPromo = checkHerenciaWeekendPromotion(cartItems, shippingAddress?.codigo_postal);
  const isPromotionEligible = !!herenciaPromo.zone;
  const promotionThreshold = herenciaPromo.threshold || 0;

  // 0. Cobertura: el código postal debe estar en la zona de entrega
  const baseCost = getShippingCostByPostalCode(shippingAddress?.codigo_postal);
  if (baseCost === null) {
    return {
      cost: 0,
      deliverable: false,
      message: NOT_DELIVERABLE_MESSAGE,
      isPromotionEligible,
      promotionThreshold
    };
  }

  // 1. Promoción Herencia (envío gratis)
  if (herenciaPromo.applied) {
    return { cost: 0, deliverable: true, isPromotionEligible, promotionThreshold };
  }

  // 2. Envío gratis por monto de compra
  const { subtotal } = calculateCartTotals(cartItems);
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return { cost: 0, deliverable: true, isPromotionEligible, promotionThreshold };
  }

  // 3. Costo de domicilio ÚNICAMENTE por código postal de la dirección
  return { cost: baseCost, deliverable: true, isPromotionEligible, promotionThreshold };
};

/**
 * Wrapper para el carrito/UI: usa la DIRECCIÓN PRINCIPAL del usuario.
 * Si no hay dirección, indica que se requiere. Si el código postal está fuera
 * de zona, devuelve `deliverable: false` con el mensaje correspondiente.
 */
export const calculateAdvancedShippingCostForCart = async (userId, cartItems) => {
  try {
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('direccion_principal_id')
      .eq('id', userId)
      .single();

    if (!user?.direccion_principal_id) {
      return {
        cost: 0,
        message: 'Por favor agregue una dirección para calcular el costo de domicilio exacto',
        needsAddress: true,
        deliverable: null,
        promotionThreshold: 0,
        isPromotionEligible: false
      };
    }

    const { data: address } = await supabaseAdmin
      .from('direcciones_envio')
      .select('*')
      .eq('id', user.direccion_principal_id)
      .single();

    if (!address) {
      return {
        cost: 0,
        message: 'Por favor configure su dirección principal para calcular el domicilio exacto',
        needsAddress: true,
        deliverable: null,
        promotionThreshold: 0,
        isPromotionEligible: false
      };
    }

    const result = await calculateShippingCostAdvanced(userId, cartItems, address);
    return {
      cost: result.cost,
      needsAddress: false,
      deliverable: result.deliverable,
      message: result.deliverable === false ? result.message : undefined,
      promotionThreshold: result.promotionThreshold,
      isPromotionEligible: result.isPromotionEligible
    };
  } catch (error) {
    console.error('Error calculating cart shipping cost:', error);
    return {
      cost: 0,
      message: 'Error calculando envío, usando costo estimado',
      needsAddress: false,
      deliverable: null,
      promotionThreshold: 0,
      isPromotionEligible: false
    };
  }
};

// Se exporta para compatibilidad con imports existentes.
export { determineZoneFromPostalCode, getShippingCostByPostalCode };
