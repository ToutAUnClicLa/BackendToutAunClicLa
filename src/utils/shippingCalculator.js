import { supabaseAdmin } from '../config/supabase.js';
import { calculateCartTotals } from './cartHelpers.js';

// ============================================================================
// CONFIGURACIÓN DE PROMOCIONES
// ============================================================================

const PROMO_WEEKEND_HERENCIA = {
  active: true,
  startDate: '2026-02-06',
  endDate: '2026-02-08',
  subcategories: [15, 17], // Herencia Cafe, Herencia Restrobar
  thresholds: {
    san_tuber: 25.00,
    riviera_sur: 40.00,
    montreal: 75.00
  }
};

const SAN_TUBER_PREFIXES = ['J4T', 'J4Y', 'J4Z', 'J3Y'];

/**
 * Detecta si el código postal pertenece a San Tuber (Saint-Hubert)
 */
const isSanTuber = (postalCode) => {
  if (!postalCode) return false;
  const prefix = postalCode.toUpperCase().replace(/\s+/g, '').substring(0, 3);
  return SAN_TUBER_PREFIXES.includes(prefix);
};

/**
 * Verifica si aplica la promoción de Herencia para el fin de semana
 */
const checkHerenciaWeekendPromotion = (cartItems, postalCode) => {
  // 1. Verificar fecha (Montreal Time)
  const currentTime = new Date();
  const montrealTimeStr = currentTime.toLocaleString("en-US", { timeZone: "America/Montreal" });
  const montrealDate = new Date(montrealTimeStr);
  const dateString = montrealDate.toISOString().split('T')[0];

  if (dateString < PROMO_WEEKEND_HERENCIA.startDate || dateString > PROMO_WEEKEND_HERENCIA.endDate) {
    return { applied: false };
  }

  // 2. Verificar que el carrito contenga SOLAMENTE productos de Herencia (15 o 17)
  const allItemsAreHerencia = cartItems.every(item =>
    PROMO_WEEKEND_HERENCIA.subcategories.includes(item.productos.subcategoria_id)
  );

  if (!allItemsAreHerencia) {
    return { applied: false, reason: 'Mixed cart' };
  }

  // 3. Calcular subtotal real (considerando variaciones)
  const subtotal = cartItems.reduce((sum, item) => {
    // Usar precio ya calculado con variaciones si está disponible, sino calcularlo
    const basePrice = parseFloat(item.productos.precio);
    return sum + (basePrice * item.cantidad);
  }, 0);

  // 4. Determinar zona y threshold
  let zone = 'montreal';
  if (isSanTuber(postalCode)) {
    zone = 'san_tuber';
  } else if (determineZoneFromPostalCode(postalCode) === 'riviera_sur') {
    zone = 'riviera_sur';
  }

  const threshold = PROMO_WEEKEND_HERENCIA.thresholds[zone];

  if (subtotal >= threshold) {
    console.log(`🎁 PROMO HERENCIA APPLIED: Zone ${zone}, Subtotal ${subtotal} >= ${threshold}`);
    return { applied: true, cost: 0, zone };
  }

  return { applied: false, reason: 'Threshold not met', subtotal, threshold, zone };
};

// ============================================================================
// CALCULADORA DE COSTOS DE ENVÍO AVANZADA
// ============================================================================

/**
 * Calcula el costo de envío para items del carrito (wrapper para UI)
 * Retorna un objeto con costo y mensaje cuando no hay dirección
 */
export const calculateAdvancedShippingCostForCart = async (userId, cartItems) => {
  try {
    // Obtener dirección principal del usuario
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('direccion_principal_id')
      .eq('id', userId)
      .single();

    if (!user?.direccion_principal_id) {
      // Sin dirección principal, usar fallback pero indicar que necesita dirección
      const fallbackCost = calculateFallbackShipping(cartItems);
      return {
        cost: fallbackCost,
        message: 'Por favor agregue una dirección para calcular el costo de domicilio exacto',
        needsAddress: true
      };
    }

    // Obtener dirección principal
    const { data: address } = await supabaseAdmin
      .from('direcciones_envio')
      .select('*')
      .eq('id', user.direccion_principal_id)
      .single();

    if (!address) {
      // Si no existe la dirección, usar fallback pero indicar que necesita configuración
      const fallbackCost = calculateFallbackShipping(cartItems);
      return {
        cost: fallbackCost,
        message: 'Por favor configure su dirección principal para calcular el domicilio exacto',
        needsAddress: true
      };
    }

    // Calcular costo de envío normal
    console.log('🎯 WRAPPER: Calling calculateShippingCostAdvanced for userId:', userId);
    const cost = await calculateShippingCostAdvanced(userId, cartItems, address);
    console.log('🎯 WRAPPER: Final shipping cost returned:', cost);

    return {
      cost: cost,
      needsAddress: false
    };

  } catch (error) {
    console.error('Error calculating cart shipping cost:', error);
    const fallbackCost = calculateFallbackShipping(cartItems);
    return {
      cost: fallbackCost,
      message: 'Error calculando envío, usando costo estimado',
      needsAddress: false
    };
  }
};

/**
 * Lógica de cálculo de envío avanzado (principal)
 */
export const calculateShippingCostAdvanced = async (userId, cartItems, shippingAddress) => {
  // 1. Verificar Promoción Especial de Fin de Semana (Herencia Feb 7-8)
  const herenciaPromo = checkHerenciaWeekendPromotion(cartItems, shippingAddress?.codigo_postal);
  if (herenciaPromo.applied) {
    console.log('🎁 Promoción Herencia aplicada: Domicilio Gratis');
    return 0;
  }

  // Si el subtotal es >= $200, envío gratis (regla original)
  // Usar el helper centralizado para asegurar que incluimos variaciones
  const cartTotals = calculateCartTotals(cartItems);
  const subtotal = cartTotals.subtotal;
  const freeShippingThreshold = 200.00;

  if (subtotal >= freeShippingThreshold) {
    return 0;
  }

  // Categorizar items del carrito
  const hasProducts = cartItems.some(item => [1, 3].includes(item.productos.categoria_id)); // Productos + Boutique
  const hasComidas = cartItems.some(item => item.productos.categoria_id === 2); // Comidas Tradicionales

  // Obtener zona del usuario basada en código postal
  const userZone = determineZoneFromPostalCode(shippingAddress.codigo_postal);

  // DEBUGGING: Mostrar detalles de todos los items para detectar el problema
  console.log('🔍 CART ITEMS DETAILED DEBUG:', cartItems.map(item => ({
    id: item.productos.id,
    name: item.productos.nombre,
    categoria_id: item.productos.categoria_id,
    subcategoria_id: item.productos.subcategoria_id,
    quantity: item.cantidad
  })));

  console.log('🚚 Shipping calculation:', {
    subtotal,
    hasProducts,
    hasComidas,
    userZone,
    userPostal: shippingAddress.codigo_postal
  });

  // CASO 1: Solo productos/boutique (sin comidas)
  if (hasProducts && !hasComidas) {
    // Primero intentar obtener el costo específico por código postal
    console.log('📦 CASE 1: Checking specific postal cost for:', shippingAddress.codigo_postal);
    const specificCost = getSpecificShippingCostByPostalCode(shippingAddress.codigo_postal);
    console.log('📦 CASE 1: Specific cost result:', specificCost);

    if (specificCost !== null) {
      console.log('📦 CASE 1: Products only - Using specific postal cost:', specificCost);
      return specificCost;
    }

    // Si no hay costo específico, usar el costo por zona
    const cost = userZone === 'riviera_sur' ? 10 : 17; // Riviera Sur: $10, Montreal: $17
    console.log('📦 CASE 1: Products only shipping (zone-based):', cost);
    console.log('📦 Conditions: hasProducts=', hasProducts, ', hasComidas=', hasComidas);
    return cost;
  }

  // CASO 2: Solo comidas (sin productos)
  if (hasComidas && !hasProducts) {
    console.log('🍽️ CASE 2: Food only shipping - calling calculateComidaOnlyShippingForCart');
    console.log('🍽️ Conditions: hasProducts=', hasProducts, ', hasComidas=', hasComidas);
    const cost = await calculateComidaOnlyShippingForCart(cartItems, shippingAddress.codigo_postal);
    console.log('🍽️ Food only shipping final cost:', cost);
    return cost;
  }

  // CASO 3: Productos + Comidas (mixto)
  if (hasProducts && hasComidas) {
    console.log('🛍️ CASE 3: MIXED ORDER DETECTED - Calling calculateMixedShippingForCart');
    console.log('🛍️ Conditions: hasProducts=', hasProducts, ', hasComidas=', hasComidas);

    // Verificar primero si hay un costo específico por código postal
    const specificCost = getSpecificShippingCostByPostalCode(shippingAddress.codigo_postal);

    if (specificCost !== null) {
      // Si hay costo específico, usarlo directamente sin cálculos adicionales
      console.log('🛍️ Mixed order - Using specific postal cost directly:', specificCost);
      return specificCost;
    }

    // Si no hay costo específico, calcular según lógica de distancias
    const cost = await calculateMixedShippingForCart(cartItems, shippingAddress.codigo_postal);
    console.log('🛍️ Mixed shipping result (no specific postal cost):', cost);

    // VERIFICACIÓN ESPECÍFICA: En Riviera Sur mixto, mínimo $10
    if (userZone === 'riviera_sur' && cost < 10) {
      console.log('⚠️ CORRECTION APPLIED: Riviera Sur mixed order must be minimum $10, was:', cost);
      return 10;
    }

    console.log('🛍️ Mixed shipping FINAL cost:', cost);
    return cost;
  }

  // Fallback - no debería llegar aquí
  console.log('❌ FALLBACK CASE - This should not happen!');
  console.log('❌ Conditions: hasProducts=', hasProducts, ', hasComidas=', hasComidas);
  const fallbackCost = userZone === 'riviera_sur' ? 10 : 17;
  console.log('⚠️ Fallback shipping:', fallbackCost);
  return fallbackCost;
};

/**
 * Obtiene el costo de envío específico por código postal
 */
const getSpecificShippingCostByPostalCode = (postalCode) => {
  if (!postalCode) {
    console.log('🔍 getSpecificShippingCostByPostalCode: No postal code provided');
    return null;
  }

  const prefix = postalCode.toUpperCase().replace(/\s+/g, '').substring(0, 3);
  console.log('🔍 getSpecificShippingCostByPostalCode: Input:', postalCode, '-> Prefix:', prefix);

  // Costos específicos por prefijo postal
  const postalCosts = {
    // $13
    'J5R': 13,
    'H3E': 13,
    // $12
    'J4B': 12,
    'J4R': 12,
    // $7.50
    'J4W': 7.50,
    'J4Z': 7.50,
    'J4Y': 7.50,
    'J4X': 7.50,
    // $6.25
    'J4P': 6.25,
    'J4S': 6.25,
    'J4V': 6.25,
    'J4T': 6.25,
    'J3Y': 6.25,
    'J3Z': 6.25,
    // $5.50
    'J4G': 5.50,
    'J4N': 5.50,
    'J4M': 5.50,
    'J4J': 5.50,
    'J4H': 5.50,
    'J4L': 5.50,
    'J4K': 5.50,
  };

  const result = postalCosts[prefix] || null;
  console.log('🔍 getSpecificShippingCostByPostalCode: Result for', prefix, '=', result);
  return result;
};

/**
 * Determina la zona basada en código postal canadiense
 */
const determineZoneFromPostalCode = (postalCode) => {
  if (!postalCode) return 'montreal';

  const cleanPostal = postalCode.toUpperCase().replace(/\s+/g, '');

  // Códigos postales de Riviera Sur que sí entregamos
  const rivieraSurPrefixes = [
    'J3Y', 'J3Z',
    'J4B', 'J4G', 'J4H', 'J4J',
    'J4L', 'J4M', 'J4N', 'J4P', 'J4R',
    'J4S', 'J4T', 'J4V', 'J4W', 'J4X',
    'J4Y', 'J4Z', 'J5R'
  ];

  const prefix = cleanPostal.substring(0, 3);
  return rivieraSurPrefixes.includes(prefix) ? 'riviera_sur' : 'montreal';
};

/**
 * Calcula distancia entre códigos postales (primeros 3 dígitos)
 */
const calculatePostalCodeDistance = (postal1, postal2) => {
  if (!postal1 || !postal2) return 'different_zone';

  const clean1 = postal1.toUpperCase().replace(/\s+/g, '').substring(0, 3);
  const clean2 = postal2.toUpperCase().replace(/\s+/g, '').substring(0, 3);

  if (clean1 === clean2) {
    return 'same_zone'; // Mismo código postal (primeros 3 dígitos)
  }

  const zone1 = determineZoneFromPostalCode(postal1);
  const zone2 = determineZoneFromPostalCode(postal2);

  if (zone1 === zone2) {
    return 'same_region'; // Misma región (ambos Riviera Sur o ambos Montreal)
  }

  return 'different_region'; // Diferentes regiones
};

/**
 * Calcula envío para solo comidas
 */
const calculateComidaOnlyShippingForCart = async (cartItems, userPostalCode) => {
  try {
    // Primero verificar si hay un costo específico para este código postal
    const specificCost = getSpecificShippingCostByPostalCode(userPostalCode);

    if (specificCost !== null) {
      console.log('🍽️ Food only - Using specific postal cost:', specificCost);
      return specificCost;
    }

    // Obtener subcategorías (restaurantes) de los items de comida
    const comidaItems = cartItems.filter(item => item.productos.categoria_id === 2);
    const subcategoryIds = [...new Set(comidaItems.map(item => item.productos.subcategoria_id))];

    console.log('🍽️ Calculating food shipping:', {
      comidaItems: comidaItems.length,
      restaurants: subcategoryIds,
      userPostal: userPostalCode
    });

    // Buscar restaurante más cercano
    const { data: restaurants } = await supabaseAdmin
      .from('subcategorias')
      .select('id, nombre, codigo_postal')
      .in('id', subcategoryIds)
      .not('codigo_postal', 'is', null);

    console.log('🏪 Found restaurants:', restaurants?.map(r => ({
      name: r.nombre,
      postal: r.codigo_postal
    })));

    if (!restaurants || restaurants.length === 0) {
      // Sin código postal de restaurante, usar lógica por zona
      const userZone = determineZoneFromPostalCode(userPostalCode);
      const fallbackCost = userZone === 'riviera_sur' ? 10 : 17;
      console.log('🏪 No restaurant postal codes, using zone fallback:', fallbackCost);
      return fallbackCost;
    }

    // Determinar zona del usuario
    const userZone = determineZoneFromPostalCode(userPostalCode);

    // Encontrar el restaurante más cercano
    let minCost = 25; // Costo máximo

    for (const restaurant of restaurants) {
      const distance = calculatePostalCodeDistance(restaurant.codigo_postal, userPostalCode);
      const restaurantZone = determineZoneFromPostalCode(restaurant.codigo_postal);

      console.log(`📍 Restaurant ${restaurant.nombre}:`, {
        restaurantPostal: restaurant.codigo_postal,
        restaurantZone: restaurantZone,
        userPostal: userPostalCode,
        userZone: userZone,
        distance: distance
      });

      switch (distance) {
        case 'same_zone':
          // Mismo código postal (primeros 3 dígitos) = $10 mínimo
          console.log('✅ Same postal zone - $10');
          return 5; // Salir inmediatamente
        case 'same_region':
          // Misma región: Riviera Sur a Riviera Sur, o Montreal a Montreal
          if (userZone === 'riviera_sur') {
            // Usuario en Riviera Sur, restaurante también en Riviera Sur
            minCost = Math.min(minCost, 10); // $10-17 dependiendo de distancia
            console.log('✅ Same region (Riviera Sur) - $10');
          } else {
            // Usuario en Montreal, restaurante también en Montreal  
            minCost = Math.min(minCost, 10);
            console.log('✅ Same region (Montreal) - $10');
          }
          break;
        case 'different_region':
          // Diferentes regiones
          if (restaurantZone === 'riviera_sur' && userZone === 'montreal') {
            // Restaurante en Riviera Sur, usuario en Montreal = $17 mínimo
            minCost = Math.min(minCost, 17);
            console.log('⚠️ Riviera Sur → Montreal - $17');
          } else if (restaurantZone === 'montreal' && userZone === 'riviera_sur') {
            // Restaurante en Montreal, usuario en Riviera Sur = $17 mínimo
            minCost = Math.min(minCost, 17);
            console.log('⚠️ Montreal → Riviera Sur - $17');
          } else {
            minCost = Math.min(minCost, 17);
            console.log('⚠️ Different region - $17');
          }
          break;
      }
    }

    console.log('🍽️ Final food-only shipping cost:', minCost);
    return minCost;

  } catch (error) {
    console.error('Error calculating comida shipping for cart:', error);
    // Fallback
    const userZone = determineZoneFromPostalCode(userPostalCode);
    return userZone === 'riviera_sur' ? 10 : 17;
  }
};

/**
 * Calcula envío para productos + comidas (mixto)
 */
const calculateMixedShippingForCart = async (cartItems, userPostalCode) => {
  try {
    const userZone = determineZoneFromPostalCode(userPostalCode);

    // Obtener subcategorías (restaurantes) de los items de comida
    const comidaItems = cartItems.filter(item => item.productos.categoria_id === 2);
    const subcategoryIds = [...new Set(comidaItems.map(item => item.productos.subcategoria_id))];

    console.log('🛍️ Mixed shipping calculation:', {
      userZone,
      userPostal: userPostalCode,
      restaurants: subcategoryIds
    });

    // Buscar restaurantes para determinar zonas
    const { data: restaurants } = await supabaseAdmin
      .from('subcategorias')
      .select('id, nombre, codigo_postal')
      .in('id', subcategoryIds)
      .not('codigo_postal', 'is', null);

    if (!restaurants || restaurants.length === 0) {
      // Sin código postal de restaurante, usar lógica simple
      const baseCost = userZone === 'riviera_sur' ? 12 : 20;
      const finalCost = Math.min(25, Math.max(10, baseCost));
      console.log('🛍️ Mixed (no restaurant postal) - fallback:', finalCost);
      return finalCost;
    }

    // Determinar el costo base según las reglas específicas
    let totalCost = 0;

    // CASO ESPECIAL: Usuario en Montreal, restaurante en Riviera Sur
    const hasRivieraSurRestaurant = restaurants.some(r =>
      determineZoneFromPostalCode(r.codigo_postal) === 'riviera_sur'
    );

    if (userZone === 'montreal' && hasRivieraSurRestaurant) {
      // Productos: $20, Comida: varía $10-17, máximo $25 total
      const productCost = 20;
      const comidaCost = await calculateComidaOnlyShippingForCart(cartItems, userPostalCode);

      console.log('🛍️ Special case - Riviera Sur restaurant → Montreal user:', {
        productCost: productCost,
        comidaCost: comidaCost
      });

      // El costo total no puede exceder $25
      totalCost = Math.min(25, productCost + Math.min(comidaCost - 7, 5)); // Ajuste para no sumar doble

    } else {
      // Casos normales
      const productCost = userZone === 'riviera_sur' ? 10 : 17;
      const comidaCost = await calculateComidaOnlyShippingForCart(cartItems, userPostalCode);

      console.log('🛍️ Normal mixed case:', {
        productCost,
        comidaCost,
        userZone
      });

      // Para pedidos mixtos normales: usar el mayor, con límites $10-25
      totalCost = Math.max(productCost, comidaCost);
    }

    // Aplicar límites finales: mínimo $10, máximo $25
    const beforeMinMax = totalCost;
    const afterMin = Math.max(10, totalCost);
    const finalCost = Math.min(25, afterMin);

    console.log('🛍️ Mixed shipping calculation steps:', {
      beforeMinMax: beforeMinMax,
      afterMin: afterMin,
      finalCost: finalCost,
      rule: 'Min $10, Max $25'
    });

    console.log('🛍️ Mixed shipping FINAL RETURN VALUE:', finalCost);
    return finalCost;

  } catch (error) {
    console.error('Error calculating mixed shipping for cart:', error);
    return 15; // Fallback para pedidos mixtos
  }
};

/**
 * Cálculo de envío fallback cuando no se puede determinar ubicación
 */
const calculateFallbackShipping = (cartItems) => {
  const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.productos.precio) * item.cantidad), 0);

  if (subtotal >= 200) {
    return 0; // Envío gratis
  }

  // Lógica simple por categoría
  const hasProducts = cartItems.some(item => [1, 3].includes(item.productos.categoria_id));
  const hasComidas = cartItems.some(item => item.productos.categoria_id === 2);

  console.log('⚠️ Using fallback shipping:', {
    hasProducts,
    hasComidas,
    subtotal
  });

  if (hasProducts && hasComidas) {
    return 15; // Mixto
  } else if (hasComidas) {
    return 12; // Solo comidas
  } else {
    return 10; // Solo productos
  }
};

// Export utility functions
export {
  determineZoneFromPostalCode,
  calculatePostalCodeDistance,
  calculateFallbackShipping
};