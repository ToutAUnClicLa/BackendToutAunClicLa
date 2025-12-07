import { supabaseAdmin } from '../config/supabase.js';
import { calculateAdvancedShippingCostForCart } from './shippingCalculator.js';

const applyDiscount = (precio, descuento) => {
  const base = parseFloat(precio || 0);
  const pct = parseFloat(descuento || 0);
  if (!pct || pct <= 0) return base;
  return base * (1 - pct / 100);
};

// Función para obtener items del carrito con variaciones
export const getCartItemsWithVariations = async (userId, options = {}) => {
  const { page = 1, limit = 20, includePagination = true } = options;
  const offset = (page - 1) * limit;

  let countData = null;
  if (includePagination) {
    const { count, error: countError } = await supabaseAdmin
      .from('carrito')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId);
    if (countError) throw countError;
    countData = count;
  }

  // Query base optimizada
  let query = supabaseAdmin
    .from('carrito')
    .select(`
      *,
      productos(
        id, nombre, descripcion, precio, categoria_id, subcategoria_id,
        imagen_principal, imagen_secundaria, imagen_terciaria,
        stock, provedor, TPS, TVQ, consigne, ecoprecio, dias_disponibles, descuento,
        categorias(id, nombre),
        subcategorias(id, nombre, Imagen, Descripcion, nacionalidades, codigo_postal, disponible, gmail, dias_abiertos, categoria_id),
        reviews(estrellas)
      )
    `)
    .eq('usuario_id', userId)
    .order('fecha_actualizacion', { ascending: false });

  if (includePagination) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: cartItems, error } = await query;
  if (error) throw error;

  // Obtener variaciones en una consulta separada
  if (cartItems && cartItems.length > 0) {
    const cartItemIds = cartItems.map(item => item.id);
    const { data: itemVariations } = await supabaseAdmin
      .from('cart_item_variations')
      .select(`
        cart_item_id, quantity, price_at_time,
        product_variations(id, name, description, price_modifier)
      `)
      .in('cart_item_id', cartItemIds);

    // Asignar variaciones a cada item y verificar disponibilidad por día
    const currentTime = new Date();
    const montrealTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "America/Montreal"}));
    const currentDayOfWeek = montrealTime.getDay();

    cartItems.forEach(item => {
      item.variations = itemVariations
        ? itemVariations.filter(v => v.cart_item_id === item.id)
        : [];

      // Verificar disponibilidad del producto según día
      if (item.productos) {
        let disponibleHoy = true;
        if (item.productos.dias_disponibles && Array.isArray(item.productos.dias_disponibles)) {
          disponibleHoy = item.productos.dias_disponibles.includes(currentDayOfWeek);
        }
        item.productos.disponible_hoy = disponibleHoy;
        item.productos.dias_disponibles = item.productos.dias_disponibles || [0,1,2,3,4,5,6];

        const precioBase = parseFloat(item.productos.precio || 0);
        const descuento = item.productos.descuento || 0;
        const precioConDescuento = applyDiscount(precioBase, descuento);
        item.productos.precio_anterior = precioBase;
        item.productos.precio = precioConDescuento;
        item.productos.descuento = descuento;
      }
    });
  }

  const result = { cartItems };
  
  if (includePagination && countData !== null) {
    const totalPages = Math.ceil(countData / limit);
    result.pagination = {
      currentPage: page,
      totalPages,
      totalItems: countData,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
    result.itemCount = countData;
  }

  return result;
};

// Función optimizada para calcular precio de un item con variaciones
const calculateItemPrice = (item) => {
  const basePrice = applyDiscount(
    item.productos?.precio_anterior ?? item.productos?.precio,
    item.productos?.descuento
  );
  let itemPrice = basePrice;
  
  if (item.variations && item.variations.length > 0) {
    const variationsTotal = item.variations.reduce((varSum, variation) => {
      const modifier = variation.price_at_time || variation.product_variations?.price_modifier || 0;
      return varSum + (parseFloat(modifier) * variation.quantity);
    }, 0);
    itemPrice += variationsTotal;
  }
  
  return itemPrice;
};

// Función para calcular totales del carrito
export const calculateCartTotals = (cartItems) => {
  let subtotal = 0;
  let totalTPS = 0;
  let totalTVQ = 0;
  let totalConsigne = 0;
  let subtotalWithTaxes = 0;
  let subtotalWithConsigne = 0;
  let totalQuantity = 0;

  cartItems.forEach(item => {
    const itemPrice = calculateItemPrice(item);
    const itemTotalPrice = itemPrice * item.cantidad;
    
    // Subtotal general
    subtotal += itemTotalPrice;
    totalQuantity += item.cantidad;

    // TPS
    const itemTPS = item.productos?.TPS || 0;
    if (itemTPS > 0) {
      totalTPS += (itemPrice * itemTPS / 100) * item.cantidad;
      subtotalWithTaxes += itemTotalPrice;
    }

    // TVQ
    const itemTVQ = item.productos?.TVQ || 0;
    if (itemTVQ > 0) {
      totalTVQ += (itemPrice * itemTVQ / 100) * item.cantidad;
      if (itemTPS === 0) { // Evitar doble conteo si ya tiene TPS
        subtotalWithTaxes += itemTotalPrice;
      }
    }

    // Consigne
    const itemConsigne = item.productos?.consigne || 0;
    if (itemConsigne > 0) {
      totalConsigne += parseFloat(itemConsigne) * item.cantidad;
      subtotalWithConsigne += itemTotalPrice;
    }
  });

  return {
    subtotal,
    totalTPS,
    totalTVQ,
    totalConsigne,
    totalTaxes: totalTPS + totalTVQ,
    subtotalWithTaxes,
    subtotalWithConsigne,
    totalQuantity
  };
};

// Función para validar cupón
export const validateCoupon = async (couponCode, userId) => {
  if (!couponCode || typeof couponCode !== 'string') {
    return { valid: false, error: 'Código de cupón inválido' };
  }

  // Buscar cupón
  const { data: coupons } = await supabaseAdmin
    .from('cupones')
    .select('*')
    .ilike('codigo', couponCode.toUpperCase().trim());
  
  const coupon = coupons?.[0];
  if (!coupon) {
    return { valid: false, error: 'Cupón no encontrado' };
  }

  // Validar estado del cupón
  if (coupon.activo === false) {
    return { valid: false, error: 'Cupón inactivo' };
  }

  if (coupon.fecha_expiracion && new Date(coupon.fecha_expiracion) < new Date()) {
    return { valid: false, error: 'Cupón expirado' };
  }

  // ✨ VALIDACIÓN UUID - Cupón único por usuario
  if (coupon.usuario_asignado && coupon.usuario_asignado !== userId) {
    console.log('❌ Cupón rechazado - UUID no coincide:', {
      couponCode: coupon.codigo,
      asignadoA: coupon.usuario_asignado,
      usuarioActual: userId
    });
    return { 
      valid: false, 
      error: 'Este cupón no está asignado a tu cuenta' 
    };
  }

  // Validar límite de usos
  if (coupon.limite_usos !== null) {
    const { data: userUsages, error: usageError } = await supabaseAdmin
      .from('cupones_usos')
      .select('id')
      .eq('cupon_id', coupon.id)
      .eq('usuario_id', userId);

    if (usageError) {
      return { valid: false, error: 'Error verificando uso del cupón' };
    }

    const userUsageCount = userUsages?.length || 0;
    if (userUsageCount >= coupon.limite_usos) {
      return { 
        valid: false, 
        error: `Has alcanzado el límite de uso para este cupón (${coupon.limite_usos} veces)` 
      };
    }
  }

  return { valid: true, coupon };
};

// Función para aplicar cupón al carrito (lógica corregida)
export const applyCouponToCart = (cartTotals, shippingCost, coupon) => {
  if (!coupon) {
    return {
      finalShippingCost: shippingCost,
      discountAmount: 0,
      couponType: null,
      total: cartTotals.subtotal + cartTotals.totalTaxes + cartTotals.totalConsigne + shippingCost,
      couponInfo: null
    };
  }

  // Detectar tipo de cupón
  const isShippingCoupon = coupon.codigo.startsWith('ENVIO') || 
                          coupon.codigo.startsWith('SHIP') ||
                          coupon.codigo.startsWith('DOMICILIO') ||
                          (coupon.descuento == 0);
  
  let finalShippingCost = shippingCost;
  let discountAmount = 0;
  let couponType = 'discount';
  
  if (isShippingCoupon) {
    // Cupón de domicilio gratis - solo afecta el envío
    finalShippingCost = 0;
    couponType = 'free_shipping';
    console.log('🚚 Cupón de envío gratis aplicado - costo de envío = 0');
  } else {
    // Cupón de descuento - solo se aplica al total SIN incluir envío
    const totalWithoutShipping = cartTotals.subtotal + cartTotals.totalTaxes + cartTotals.totalConsigne;
    discountAmount = (totalWithoutShipping * coupon.descuento) / 100;
    console.log(`💰 Cupón de descuento aplicado - ${coupon.descuento}% solo al subtotal + impuestos + consigne`);
  }
  
  // Calcular total final
  const total = Math.max(0, cartTotals.subtotal + cartTotals.totalTaxes + cartTotals.totalConsigne + finalShippingCost - discountAmount);

  return {
    finalShippingCost,
    discountAmount,
    couponType,
    total,
    couponInfo: {
      id: coupon.id,
      code: coupon.codigo,
      discount: isShippingCoupon ? 0 : coupon.descuento,
      type: couponType,
      description: isShippingCoupon ? 'Envío gratis' : `${coupon.descuento}% de descuento`
    }
  };
};

// Función para agregar rating promedio
export const addAverageRating = (cartItems) => {
  return cartItems.map(item => ({
    ...item,
    productos: {
      ...item.productos,
      averageRating: item.productos.reviews?.length > 0 
        ? item.productos.reviews.reduce((sum, review) => sum + review.estrellas, 0) / item.productos.reviews.length
        : 0,
      reviewCount: item.productos.reviews?.length || 0
    }
  }));
};

// Función para aplicar cupón a todo el carrito del usuario
export const applyCartCoupon = async (userId, couponCode) => {
  const now = new Date().toISOString();
  
  // Validar cupón
  const validation = await validateCoupon(couponCode, userId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const coupon = validation.coupon;
  const isShippingCoupon = coupon.codigo.startsWith('ENVIO') || 
                          coupon.codigo.startsWith('SHIP') ||
                          coupon.codigo.startsWith('DOMICILIO') ||
                          (coupon.descuento == 0);

  // Aplicar cupón a todos los items del carrito
  const { error: updateError } = await supabaseAdmin
    .from('carrito')
    .update({
      cupon_codigo: coupon.codigo,
      cupon_tipo: isShippingCoupon ? 'free_shipping' : 'discount',
      cupon_descuento: coupon.descuento,
      cupon_aplicado_fecha: now
    })
    .eq('usuario_id', userId);

  if (updateError) {
    return { success: false, error: 'Error aplicando cupón al carrito' };
  }

  return { success: true, coupon };
};

// Función para remover cupón del carrito
export const removeCartCoupon = async (userId) => {
  const { error } = await supabaseAdmin
    .from('carrito')
    .update({
      cupon_codigo: null,
      cupon_tipo: null,
      cupon_descuento: 0,
      cupon_aplicado_fecha: null
    })
    .eq('usuario_id', userId);

  if (error) {
    return { success: false, error: 'Error removiendo cupón del carrito' };
  }

  return { success: true };
};
