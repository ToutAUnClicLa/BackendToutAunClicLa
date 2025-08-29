import { supabaseAdmin } from '../config/supabase.js';

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

    // Usar la misma lógica que en stripeController
    console.log('🎯 WRAPPER: Calling calculateShippingCostAdvanced for userId:', userId);
    const cost = await calculateShippingCostAdvanced(userId, cartItems, address);
    console.log('🎯 WRAPPER: Final shipping cost returned:', cost);
    return {
      cost: cost,
      message: null,
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
  // Si el subtotal es >= $200, envío gratis (regla original)
  const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.productos.precio) * item.cantidad), 0);
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
    const cost = userZone === 'riviera_sur' ? 10 : 17; // Riviera Sur: $10, Montreal: $17
    console.log('📦 CASE 1: Products only shipping:', cost);
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
    const cost = await calculateMixedShippingForCart(cartItems, shippingAddress.codigo_postal);
    console.log('🛍️ Mixed shipping result BEFORE correction:', cost);
    
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
 * Determina la zona basada en código postal canadiense
 */
const determineZoneFromPostalCode = (postalCode) => {
  if (!postalCode) return 'montreal';
  
  const cleanPostal = postalCode.toUpperCase().replace(/\s+/g, '');
  
  // Códigos postales de Riviera Sur (South Shore Montreal)
  const rivieraSurPrefixes = [
    'J3V', 'J3W', 'J3X', 'J3Y', 'J3Z',
    'J4B', 'J4G', 'J4H', 'J4J', 'J4K', 
    'J4L', 'J4M', 'J4N', 'J4P', 'J4R', 
    'J4S', 'J4T', 'J4V', 'J4W', 'J4X', 
    'J4Y', 'J4Z', 'J5A', 'J5B', 'J5C',
    'J5J', 'J5K', 'J5L', 'J5M', 'J5R',
    'J5T', 'J5V', 'J5W', 'J5X', 'J5Y', 'J5Z'
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
          return 10; // Salir inmediatamente
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