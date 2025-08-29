import { supabaseAdmin } from '../config/supabase.js';
import { calculateAdvancedShippingCostForCart } from '../utils/shippingCalculator.js';
import {
  getCartItemsWithVariations,
  calculateCartTotals,
  validateCoupon,
  applyCouponToCart,
  addAverageRating,
  applyCartCoupon,
  removeCartCoupon
} from '../utils/cartHelpers.js';

// Helper function to get Montreal time
const getMontrealTime = () => {
  const now = new Date();
  // Convert to Montreal timezone
  const montrealTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Montreal"}));
  return montrealTime;
};

// Helper function to get available delivery hours for today
const getAvailableHoursToday = () => {
  const montrealNow = getMontrealTime();
  const currentHour = montrealNow.getHours();
  const currentMinute = montrealNow.getMinutes();
  
  console.log('🕐 Montreal time for availability check:', montrealNow.toLocaleString('en-CA'), 'Hour:', currentHour, 'Minute:', currentMinute);
  
  // Horarios de entrega: 11:00 AM - 9:00 PM (última entrega)
  // Debe pedirse 1 hora antes, so último pedido para hoy es a las 8:00 PM
  const deliveryStartHour = 11; // 11:00 AM
  const deliveryEndHour = 21; // 9:00 PM (última entrega)
  const orderCutoffHour = 20; // 8:00 PM (última orden para hoy)
  
  // NUEVA LÓGICA: Después de medianoche (00:00 - 05:59) se considera un nuevo día
  // En estas horas, se puede pedir para entrega el "mismo día" (que técnicamente es hoy)
  const isEarlyMorning = currentHour >= 0 && currentHour < 6;
  
  if (isEarlyMorning) {
    console.log('🌙 Early morning hours - all day slots available');
    // En la madrugada, todas las horas del día están disponibles (11:00 AM - 9:00 PM)
    const availableHours = [];
    for (let hour = deliveryStartHour; hour <= deliveryEndHour; hour++) {
      availableHours.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < deliveryEndHour) {
        availableHours.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return availableHours;
  }
  
  // Lógica normal: Si ya pasó las 8:00 PM, no hay horarios disponibles para hoy
  if (currentHour >= orderCutoffHour) {
    console.log('⏰ Past cutoff hour (8:00 PM Montreal time) - no delivery for today');
    return [];
  }
  
  // Calcular primera hora disponible (1 hora después de ahora)
  let startHour = currentHour + 1;
  let startMinute = currentMinute;
  
  // Si los minutos hacen que se pase a la siguiente hora
  if (startMinute > 0) {
    startHour += 1;
    startMinute = 0;
  }
  
  // Asegurar que esté dentro del rango de entrega
  startHour = Math.max(startHour, deliveryStartHour);
  
  // Si la hora de inicio es después de las 8:00 PM, no hay horas disponibles
  if (startHour > deliveryEndHour) {
    return [];
  }
  
  // Generar horarios disponibles
  const availableHours = [];
  for (let hour = startHour; hour <= deliveryEndHour; hour++) {
    availableHours.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < deliveryEndHour) {
      availableHours.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  
  return availableHours;
};

// Helper function to get available delivery hours for tomorrow
const getAvailableHoursTomorrow = () => {
  // Mañana está disponible desde 11:00 AM hasta 9:00 PM
  const availableHours = [];
  for (let hour = 11; hour <= 21; hour++) {
    availableHours.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 21) {
      availableHours.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return availableHours;
};

// Helper function to validate delivery time and type
const validateDeliveryTimeAndType = (preferredTime, deliveryType) => {
  const montrealNow = getMontrealTime();
  const currentHour = montrealNow.getHours();
  const currentMinute = montrealNow.getMinutes();
  
  console.log('🕐 Validating delivery - Montreal time:', montrealNow.toLocaleString('en-CA'), 'Preferred:', preferredTime, 'Type:', deliveryType);
  
  // Validar formato de hora
  if (!/^([0-9]{1,2}):[0-5][0-9]$/.test(preferredTime)) {
    return {
      valid: false,
      error: 'Invalid time format. Use HH:MM',
      availableHours: []
    };
  }
  
  const [prefHour, prefMinute] = preferredTime.split(':').map(Number);
  
  // Validar que la hora esté en el rango general (11:00 AM - 9:00 PM)
  if (prefHour < 11 || prefHour > 21) {
    return {
      valid: false,
      error: 'Delivery hours are 11:00 AM - 9:00 PM',
      availableHours: []
    };
  }
  
  // Normalizar tipos de entrega - aceptar tanto frontend como backend formats
  const normalizedType = deliveryType === 'estandar' ? 'hoy' : 
                         deliveryType === 'siguiente_dia' ? 'siguiente_dia' : 
                         deliveryType;

  if (normalizedType === 'hoy' || normalizedType === 'estandar') {
    const availableHours = getAvailableHoursToday();
    
    console.log('📅 Checking delivery for today. Available hours:', availableHours.length > 0 ? availableHours.join(', ') : 'NONE');
    
    // Si no hay horas disponibles para hoy
    if (availableHours.length === 0) {
      return {
        valid: false,
        error: 'No delivery slots available today. Orders must be placed 1 hour before delivery and last delivery is at 9:00 PM.',
        availableHours: [],
        suggestTomorrow: true
      };
    }
    
    // Verificar si la hora preferida está disponible
    // Necesitamos ser más flexibles con la validación
    const preferredTimeMinutes = prefHour * 60 + prefMinute;
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const minimumTimeMinutes = currentTimeMinutes + 60; // 1 hora desde ahora
    
    // La hora preferida debe ser al menos 1 hora desde ahora
    if (preferredTimeMinutes < minimumTimeMinutes) {
      const nextAvailableHour = Math.ceil(minimumTimeMinutes / 60);
      const nextAvailableTime = `${nextAvailableHour.toString().padStart(2, '0')}:00`;
      
      return {
        valid: false,
        error: `Delivery must be at least 1 hour from now. Next available: ${nextAvailableTime}`,
        availableHours: availableHours
      };
    }
    
    // Verificar si está en horario de entrega
    if (!availableHours.includes(preferredTime)) {
      return {
        valid: false,
        error: `Time ${preferredTime} not available today. Available slots: ${availableHours.join(', ')}`,
        availableHours: availableHours
      };
    }
    
    return {
      valid: true,
      type: 'estandar', // Mismo día = estándar
      availableHours: availableHours
    };
  }
  
  if (normalizedType === 'siguiente_dia') {
    const availableHours = getAvailableHoursTomorrow();
    
    // Para mañana, cualquier hora en el rango es válida
    if (!availableHours.includes(preferredTime)) {
      return {
        valid: false,
        error: `Time ${preferredTime} not available. Available hours: 11:00 AM - 9:00 PM`,
        availableHours: availableHours
      };
    }
    
    return {
      valid: true,
      type: 'siguiente_dia',
      availableHours: availableHours
    };
  }

  // Si no se especifica tipo, auto-detectar basado en hora actual
  if (!deliveryType || deliveryType === null || deliveryType === undefined) {
    // Después de medianoche (00:00 - 06:00), considerar que ya es un nuevo día
    const isEarlyMorning = currentHour >= 0 && currentHour < 6;
    const isAfterCutoff = currentHour >= 20; // Después de 8:00 PM
    
    if (isEarlyMorning || !isAfterCutoff) {
      // Intentar entrega el mismo día si aún hay tiempo
      const availableHours = getAvailableHoursToday();
      if (availableHours.length > 0 && availableHours.includes(preferredTime)) {
        return {
          valid: true,
          type: 'estandar',
          availableHours: availableHours
        };
      }
    }
    
    // Default a siguiente día
    const tomorrowHours = getAvailableHoursTomorrow();
    return {
      valid: true,
      type: 'siguiente_dia',
      availableHours: tomorrowHours
    };
  }
  
  // Tipo de entrega inválido
  return {
    valid: false,
    error: 'Delivery type must be estandar or siguiente_dia',
    availableHours: []
  };
};

// Legacy function - mantener compatibilidad pero marcar como deprecated
const determineDeliveryType = (preferredTime) => {
  console.warn('determineDeliveryType is deprecated. Use validateDeliveryTimeAndType instead.');
  const montrealNow = getMontrealTime();
  const currentHour = montrealNow.getHours();
  
  // Si ya son más de las 8:00 PM, el pedido es para el día siguiente
  const isAfterCutoff = currentHour >= 20;
  
  // Si la hora preferida es después de las 21:00, también es día siguiente  
  const [prefHour] = preferredTime.split(':').map(Number);
  const isPrefTimeNextDay = prefHour > 21;
  
  return (isAfterCutoff || isPrefTimeNextDay) ? 'siguiente_dia' : 'estandar';
};

// Helper function to calculate average rating for products
const addAverageRating = (cartItems) => {
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

const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Obtener items del carrito con paginación
    const { cartItems, pagination, itemCount } = await getCartItemsWithVariations(userId, {
      page,
      limit,
      includePagination: true
    });

    // Obtener todos los items para calcular totales
    const { cartItems: allItems } = await getCartItemsWithVariations(userId, {
      includePagination: false
    });

    // Calcular totales usando helper optimizado
    const cartTotals = calculateCartTotals(allItems);

    // Calcular costos de envío
    console.log('🚚 Calculating shipping for userId:', userId, 'items:', allItems.length);
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, allItems);
    const shippingCost = shippingResult.cost;

    // Verificar si hay cupón aplicado en el carrito
    let appliedCoupon = null;
    if (allItems.length > 0 && allItems[0].cupon_codigo) {
      const couponValidation = await validateCoupon(allItems[0].cupon_codigo, userId);
      if (couponValidation.valid) {
        appliedCoupon = couponValidation.coupon;
      }
    }

    // Aplicar cupón si existe
    const couponResult = applyCouponToCart(cartTotals, shippingCost, appliedCoupon);
    
    const shippingThreshold = 200;
    const cartItemsWithRating = addAverageRating(cartItems);

    console.log('💰 Final totals:', {
      subtotal: cartTotals.subtotal,
      totalTaxes: cartTotals.totalTaxes,
      shippingCost: couponResult.finalShippingCost,
      discountAmount: couponResult.discountAmount,
      total: couponResult.total
    });

    res.json({
      cartItems: cartItemsWithRating,
      total: couponResult.total,
      itemCount,
      pagination,
      appliedCoupon: couponResult.couponInfo,
      summary: {
        totalItems: itemCount,
        totalQuantity: cartTotals.totalQuantity,
        subtotal: cartTotals.subtotal,
        subtotalWithTaxes: cartTotals.subtotalWithTaxes,
        subtotalWithConsigne: cartTotals.subtotalWithConsigne,
        totalTPS: cartTotals.totalTPS,
        totalTVQ: cartTotals.totalTVQ,
        totalConsigne: cartTotals.totalConsigne,
        totalTaxes: cartTotals.totalTaxes,
        shippingCost: couponResult.finalShippingCost,
        originalShippingCost: shippingCost,
        shippingMessage: shippingResult.message,
        needsAddress: shippingResult.needsAddress,
        shippingThreshold,
        discountAmount: couponResult.discountAmount,
        total: couponResult.total
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      error: 'Failed to get cart',
      message: error.message,
      details: error.details || null
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      productId, 
      quantity, 
      horaEntregaPreferida = '18:00',
      metodoEntrega = 'puerta',
      notasEntrega = null,
      tipoEntrega, // Enviado por el frontend
      variations = [] // Array de variaciones seleccionadas: [{variationId: 1, quantity: 1}, ...]
    } = req.body;

    // Validar usando la nueva función flexible
    const validationResult = validateDeliveryTimeAndType(
      horaEntregaPreferida, 
      tipoEntrega
    );

    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Invalid delivery configuration',
        message: validationResult.error,
        ...(validationResult.availableHours && { 
          availableHours: validationResult.availableHours 
        })
      });
    }

    // Usar el tipo de entrega validado (puede ser sugerido si no fue enviado)
    const finalTipoEntrega = validationResult.type;

    // Validar variaciones si se proporcionaron
    let validVariations = [];
    if (variations && variations.length > 0) {
      // Validar que las variaciones existan y pertenezcan al producto
      const variationIds = variations.map(v => v.variationId);
      const { data: varData, error: variationError } = await supabaseAdmin
        .from('product_variations')
        .select(`
          id, 
          name, 
          price_modifier, 
          stock,
          variation_groups!inner(producto_id, group_name, is_required, max_selections)
        `)
        .in('id', variationIds)
        .eq('variation_groups.producto_id', productId)
        .eq('active', true);

      if (variationError) {
        throw variationError;
      }

      if (varData.length !== variations.length) {
        return res.status(400).json({
          error: 'Invalid variations',
          message: 'One or more selected variations are invalid or do not belong to this product'
        });
      }

      validVariations = varData;

      // Verificar stock de variaciones si tienen stock específico
      for (const variation of variations) {
        const validVar = validVariations.find(v => v.id === variation.variationId);
        if (validVar && validVar.stock !== null && validVar.stock < (variation.quantity || 1)) {
          return res.status(400).json({
            error: 'Insufficient variation stock',
            message: `Insufficient stock for variation "${validVar.name}". Available: ${validVar.stock}`
          });
        }
      }
    }

    // Validate delivery method
    const validMetodos = ['puerta', 'manos', 'recepcion'];
    if (!validMetodos.includes(metodoEntrega)) {
      return res.status(400).json({
        error: 'Invalid delivery method',
        message: 'Delivery method must be one of: puerta, manos, recepcion'
      });
    }

    // Check if product exists and has enough stock
    const { data: product, error: productError } = await supabaseAdmin
      .from('productos')
      .select('id, stock')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    // No hay campo 'activo', así que eliminamos esa validación

    if (product.stock < quantity) {
      return res.status(400).json({
        error: 'Insufficient stock',
        message: `Only ${product.stock} items available`
      });
    }

    // Check if item already exists in cart
    const { data: existingItem } = await supabaseAdmin
      .from('carrito')
      .select('id, cantidad')
      .eq('usuario_id', userId)
      .eq('producto_id', productId)
      .single();

    if (existingItem) {
      // Update existing item
      const newQuantity = existingItem.cantidad + quantity;
      
      if (product.stock < newQuantity) {
        return res.status(400).json({
          error: 'Insufficient stock',
          message: `Only ${product.stock} items available`
        });
      }

      const { data: updatedItem, error } = await supabaseAdmin
        .from('carrito')
        .update({ 
          cantidad: newQuantity,
          hora_entrega_preferida: horaEntregaPreferida,
          metodo_entrega: metodoEntrega,
          notas_entrega: notasEntrega,
          tipo_entrega: finalTipoEntrega
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Guardar variaciones si las hay
      if (variations && variations.length > 0) {
        // Primero eliminar variaciones existentes
        await supabaseAdmin
          .from('cart_item_variations')
          .delete()
          .eq('cart_item_id', existingItem.id);

        // Insertar nuevas variaciones
        const variationInserts = variations.map(variation => {
          const validVar = validVariations.find(v => v.id === variation.variationId);
          return {
            cart_item_id: existingItem.id,
            variation_id: variation.variationId,
            quantity: variation.quantity || 1,
            price_at_time: validVar ? validVar.price_modifier : 0
          };
        });

        const { error: variationError } = await supabaseAdmin
          .from('cart_item_variations')
          .insert(variationInserts);

        if (variationError) {
          console.error('Error saving variations:', variationError);
        }
      }

      res.json({
        message: 'Cart updated successfully',
        cartItem: updatedItem,
        variations: variations.length,
        deliveryInfo: {
          type: finalTipoEntrega,
          description: finalTipoEntrega === 'siguiente_dia' ? 
            'Entrega programada para el día siguiente' : 
            'Entrega estándar (2-3 días hábiles)'
        }
      });
    } else {
      // Create new cart item
      const { data: cartItem, error } = await supabaseAdmin
        .from('carrito')
        .insert([{
          usuario_id: userId,
          producto_id: productId,
          cantidad: quantity,
          hora_entrega_preferida: horaEntregaPreferida,
          metodo_entrega: metodoEntrega,
          notas_entrega: notasEntrega,
          tipo_entrega: finalTipoEntrega
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Guardar variaciones si las hay
      if (variations && variations.length > 0) {
        const variationInserts = variations.map(variation => {
          const validVar = validVariations.find(v => v.id === variation.variationId);
          return {
            cart_item_id: cartItem.id,
            variation_id: variation.variationId,
            quantity: variation.quantity || 1,
            price_at_time: validVar ? validVar.price_modifier : 0
          };
        });

        const { error: variationError } = await supabaseAdmin
          .from('cart_item_variations')
          .insert(variationInserts);

        if (variationError) {
          console.error('Error saving variations:', variationError);
        }
      }

      res.status(201).json({
        message: 'Item added to cart successfully',
        cartItem,
        variations: variations.length,
        deliveryInfo: {
          type: finalTipoEntrega,
          description: finalTipoEntrega === 'siguiente_dia' ? 
            'Entrega programada para el día siguiente' : 
            'Entrega estándar (2-3 días hábiles)'
        }
      });
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      error: 'Failed to add item to cart',
      message: error.message
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { 
      quantity,
      horaEntregaPreferida,
      metodoEntrega,
      notasEntrega,
      tipoEntrega // Enviado por el frontend
    } = req.body;

    // Validar delivery options si se proporcionan
    let finalTipoEntrega;
    if (horaEntregaPreferida !== undefined) {
      const validationResult = validateDeliveryTimeAndType(
        horaEntregaPreferida, 
        tipoEntrega
      );

      if (!validationResult.valid) {
        return res.status(400).json({
          error: 'Invalid delivery configuration',
          message: validationResult.error,
          ...(validationResult.availableHours && { 
            availableHours: validationResult.availableHours 
          })
        });
      }

      finalTipoEntrega = validationResult.type;
    }

    // Validate delivery method if provided
    if (metodoEntrega) {
      const validMetodos = ['puerta', 'manos', 'recepcion'];
      if (!validMetodos.includes(metodoEntrega)) {
        return res.status(400).json({
          error: 'Invalid delivery method',
          message: 'Delivery method must be one of: puerta, manos, recepcion'
        });
      }
    }

    // Get cart item with product info
    const { data: cartItem, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(
          id,
          nombre,
          descripcion,
          precio,
          categoria_id,
          subcategoria_id,
          imagen_principal,
          imagen_secundaria,
          imagen_terciaria,
          stock,
          provedor,
          TPS,
          TVQ,
          consigne,
          categorias(id, nombre),
          subcategorias(id, nombre, Imagen, Descripcion)
        )
      `)
      .eq('id', id)
      .eq('usuario_id', userId)
      .single();

    if (cartError || !cartItem) {
      return res.status(404).json({
        error: 'Cart item not found',
        message: 'The requested cart item does not exist'
      });
    }

    // No hay campo 'activo', así que eliminamos esa validación

    if (cartItem.productos.stock < quantity) {
      return res.status(400).json({
        error: 'Insufficient stock',
        message: `Only ${cartItem.productos.stock} items available`
      });
    }

    // Prepare update object
    const updateData = {};
    if (quantity !== undefined) updateData.cantidad = quantity;
    if (horaEntregaPreferida !== undefined) {
      updateData.hora_entrega_preferida = horaEntregaPreferida;
      updateData.tipo_entrega = finalTipoEntrega;
    }
    if (metodoEntrega !== undefined) updateData.metodo_entrega = metodoEntrega;
    if (notasEntrega !== undefined) updateData.notas_entrega = notasEntrega;

    const { data: updatedItem, error } = await supabaseAdmin
      .from('carrito')
      .update(updateData)
      .eq('id', id)
      .eq('usuario_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const response = {
      message: 'Cart item updated successfully',
      cartItem: updatedItem
    };

    // Add delivery info if tipo_entrega was updated
    if (finalTipoEntrega) {
      response.deliveryInfo = {
        type: finalTipoEntrega,
        description: finalTipoEntrega === 'siguiente_dia' ? 
          'Entrega programada para el día siguiente' : 
          'Entrega estándar (2-3 días hábiles)'
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      error: 'Failed to update cart item',
      message: error.message
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('carrito')
      .delete()
      .eq('id', id)
      .eq('usuario_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      error: 'Failed to remove item from cart',
      message: error.message
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('carrito')
      .delete()
      .eq('usuario_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      error: 'Failed to clear cart',
      message: error.message
    });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Coupon code is required'
      });
    }

    // Validar cupón usando helper
    const validation = await validateCoupon(couponCode, userId);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid coupon',
        message: validation.error
      });
    }

    // Obtener items del carrito
    const { cartItems } = await getCartItemsWithVariations(userId, { includePagination: false });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Cannot apply coupon to empty cart'
      });
    }

    // Aplicar cupón al carrito (persistirlo)
    const applyResult = await applyCartCoupon(userId, couponCode);
    if (!applyResult.success) {
      return res.status(500).json({
        error: 'Failed to apply coupon',
        message: applyResult.error
      });
    }

    // Calcular totales con cupón aplicado
    const cartTotals = calculateCartTotals(cartItems);
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, cartItems);
    const couponResult = applyCouponToCart(cartTotals, shippingResult.cost, validation.coupon);

    console.log('🎫 Coupon applied and persisted:', {
      couponCode: validation.coupon.codigo,
      type: couponResult.couponType,
      subtotalWithVariations: cartTotals.subtotal,
      originalShipping: shippingResult.cost,
      finalShipping: couponResult.finalShippingCost,
      discountAmount: couponResult.discountAmount,
      total: couponResult.total
    });

    res.json({
      message: 'Coupon applied successfully',
      coupon: couponResult.couponInfo,
      cartSummary: {
        subtotal: cartTotals.subtotal,
        totalTPS: cartTotals.totalTPS,
        totalTVQ: cartTotals.totalTVQ,
        totalConsigne: cartTotals.totalConsigne,
        totalTaxes: cartTotals.totalTaxes,
        shippingCost: couponResult.finalShippingCost,
        originalShippingCost: shippingResult.cost,
        shippingMessage: shippingResult.message,
        needsAddress: shippingResult.needsAddress,
        discountAmount: couponResult.discountAmount,
        total: couponResult.total,
        itemCount: cartItems.length,
        freeShippingApplied: couponResult.couponType === 'free_shipping',
        savings: couponResult.discountAmount + (couponResult.couponType === 'free_shipping' && shippingResult.cost > 0 ? shippingResult.cost : 0)
      }
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({
      error: 'Failed to apply coupon',
      message: error.message
    });
  }
};

const getCartWithCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const { couponCode } = req.query;

    // Get cart items
    const { data: cartItems, error } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(
          id,
          nombre,
          descripcion,
          precio,
          categoria_id,
          subcategoria_id,
          imagen_principal,
          imagen_secundaria,
          imagen_terciaria,
          stock,
          provedor,
          TPS,
          TVQ,
          consigne,
          categorias(id, nombre),
          subcategorias(id, nombre, Imagen, Descripcion),
          reviews(estrellas)
        )
      `)
      .eq('usuario_id', userId);

    if (error) {
      throw error;
    }

    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.productos.precio * item.cantidad);
    }, 0);

    // Calculate total TPS and TVQ for all items in cart
    const totalTPS = cartItems.reduce((sum, item) => {
      const itemTPS = item.productos.TPS || 0;
      const tpsAmount = itemTPS > 0 ? (item.productos.precio * itemTPS / 100) * item.cantidad : 0;
      return sum + tpsAmount;
    }, 0);

    const totalTVQ = cartItems.reduce((sum, item) => {
      const itemTVQ = item.productos.TVQ || 0;
      const tvqAmount = itemTVQ > 0 ? (item.productos.precio * itemTVQ / 100) * item.cantidad : 0;
      return sum + tvqAmount;
    }, 0);

    const totalConsigne = cartItems.reduce((sum, item) => {
      const itemConsigne = item.productos.consigne || 0;
      return sum + (itemConsigne * item.cantidad);
    }, 0);

    // Calculate totals for products with different tax types
    const subtotalWithTaxes = cartItems.reduce((sum, item) => {
      const hasTaxes = (item.productos.TPS && item.productos.TPS > 0) || 
                      (item.productos.TVQ && item.productos.TVQ > 0);
      if (hasTaxes) {
        return sum + (item.productos.precio * item.cantidad);
      }
      return sum;
    }, 0);

    const subtotalWithConsigne = cartItems.reduce((sum, item) => {
      const hasConsigne = item.productos.consigne && item.productos.consigne > 0;
      if (hasConsigne) {
        return sum + (item.productos.precio * item.cantidad);
      }
      return sum;
    }, 0);

    // Calculate shipping using advanced algorithm
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, cartItems);
    const shippingCost = shippingResult.cost;

    const totalTaxes = totalTPS + totalTVQ;
    const totalBeforeDiscount = subtotal + totalTaxes + totalConsigne + shippingCost;

    let discountAmount = 0;
    let appliedCoupon = null;

    // Apply coupon if provided
    let freeShipping = false;
    if (couponCode) {
      // Buscar cupón con trim para manejar espacios/saltos de línea
      const { data: coupons } = await supabaseAdmin
        .from('cupones')
        .select('*')
        .ilike('codigo', couponCode.toUpperCase().trim());
      
      const coupon = coupons && coupons.length > 0 ? coupons[0] : null;

      if (coupon && coupon.activo !== false && (!coupon.fecha_expiracion || new Date(coupon.fecha_expiracion) >= new Date())) {
        
        // Check user usage limits - limite_usos now represents uses per user
        let canUseCoupon = true;
        let userUsageCount = 0;
        
        if (coupon.limite_usos !== null) {
          const { data: userUsages } = await supabaseAdmin
            .from('cupones_usos')
            .select('id')
            .eq('cupon_id', coupon.id)
            .eq('usuario_id', userId);

          userUsageCount = userUsages ? userUsages.length : 0;
          canUseCoupon = userUsageCount < coupon.limite_usos;
        }

        if (canUseCoupon) {
          // Check if it's a free shipping coupon (starts with ENVIO or SHIP, or descuento = 0)
          const isShippingCoupon = coupon.codigo.startsWith('ENVIO') || 
                                  coupon.codigo.startsWith('SHIP') ||
                                  (coupon.descuento == 0);
          
          if (isShippingCoupon) {
            // Free shipping coupon - no discount on price, just free shipping
            freeShipping = true;
            appliedCoupon = {
              id: coupon.id,
              code: coupon.codigo,
              discount: 0,
              type: 'free_shipping',
              description: 'Envío gratis',
              usageInfo: {
                usesRemaining: coupon.limite_usos ? coupon.limite_usos - userUsageCount : null,
                unlimited: coupon.limite_usos === null
              }
            };
          } else {
            // Regular discount coupon - apply discount to total (including shipping calculated by backend)
            const totalBeforeDiscount = subtotal + totalTaxes + totalConsigne + shippingCost;
            discountAmount = (totalBeforeDiscount * coupon.descuento) / 100;
            appliedCoupon = {
              id: coupon.id,
              code: coupon.codigo,
              discount: coupon.descuento,
              type: 'discount',
              description: `${coupon.descuento}% de descuento`,
              usageInfo: {
                usesRemaining: coupon.limite_usos ? coupon.limite_usos - userUsageCount : null,
                unlimited: coupon.limite_usos === null
              }
            };
          }
        }
      }
    }

    // Calculate final costs
    const finalShippingCost = freeShipping ? 0 : shippingCost;
    const finalTotalBeforeDiscount = subtotal + totalTaxes + totalConsigne + finalShippingCost;
    const shippingThreshold = 200; // Umbral para envío gratis
    
    const total = Math.max(0, finalTotalBeforeDiscount - discountAmount);

    // Add average rating to cart items
    const cartItemsWithRating = addAverageRating(cartItems);

    res.json({
      cartItems: cartItemsWithRating,
      subtotal,
      discountAmount,
      total,
      itemCount: cartItems.length,
      appliedCoupon,
      summary: {
        totalItems: cartItems.length,
        totalQuantity: cartItems.reduce((sum, item) => sum + item.cantidad, 0),
        subtotal,
        subtotalWithTaxes: subtotalWithTaxes,
        subtotalWithConsigne: subtotalWithConsigne,
        totalTPS: totalTPS,
        totalTVQ: totalTVQ,
        totalConsigne: totalConsigne,
        totalTaxes: totalTaxes,
        shippingCost: finalShippingCost,
        originalShippingCost: shippingCost,
        shippingMessage: shippingResult.message,
        needsAddress: shippingResult.needsAddress,
        shippingThreshold: shippingThreshold,
        totalBeforeDiscount: finalTotalBeforeDiscount,
        total,
        discount: discountAmount,
        savings: discountAmount + (freeShipping && shippingCost > 0 ? shippingCost : 0),
        freeShippingApplied: freeShipping
      }
    });
  } catch (error) {
    console.error('Get cart with coupon error:', error);
    res.status(500).json({
      error: 'Failed to get cart',
      message: error.message
    });
  }
};

const updateDeliveryOptions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      horaEntregaPreferida = '18:00',
      metodoEntrega = 'puerta',
      notasEntrega = null,
      aplicarATodos = true, // Por defecto aplicar a todos los items (una sola entrega)
      tipoEntrega // Enviado por el frontend
    } = req.body;

    // Validar usando la nueva función flexible
    const validationResult = validateDeliveryTimeAndType(
      horaEntregaPreferida, 
      tipoEntrega
    );

    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Invalid delivery configuration',
        message: validationResult.error,
        ...(validationResult.availableHours && { 
          availableHours: validationResult.availableHours 
        })
      });
    }

    // Usar el tipo de entrega validado (puede ser sugerido si no fue enviado)
    const finalTipoEntrega = validationResult.type;

    // Validate delivery method
    const validMetodos = ['puerta', 'manos', 'recepcion'];
    if (!validMetodos.includes(metodoEntrega)) {
      return res.status(400).json({
        error: 'Invalid delivery method',
        message: 'Delivery method must be one of: puerta, manos, recepcion'
      });
    }

    const updateData = {
      hora_entrega_preferida: horaEntregaPreferida,
      metodo_entrega: metodoEntrega,
      notas_entrega: notasEntrega,
      tipo_entrega: finalTipoEntrega
    };

    if (aplicarATodos) {
      // Actualizar todos los items del carrito del usuario (comportamiento por defecto)
      const { data: updatedItems, error } = await supabaseAdmin
        .from('carrito')
        .update(updateData)
        .eq('usuario_id', userId)
        .select();

      if (error) {
        throw error;
      }

      res.json({
        message: 'Delivery options updated for entire cart',
        updatedItems: updatedItems.length,
        deliveryOptions: {
          horaEntregaPreferida,
          metodoEntrega,
          notasEntrega,
          tipoEntrega: finalTipoEntrega
        },
        deliveryInfo: {
          type: finalTipoEntrega,
          description: finalTipoEntrega === 'siguiente_dia' ? 
            'Entrega programada para el día siguiente' : 
            'Entrega estándar (2-3 días hábiles)'
        }
      });
    } else {
      // Solo aplicar a items que no tengan configuración específica (uso avanzado)
      const { data: updatedItems, error } = await supabaseAdmin
        .from('carrito')
        .update(updateData)
        .eq('usuario_id', userId)
        .is('hora_entrega_preferida', null)
        .select();

      if (error) {
        throw error;
      }

      res.json({
        message: 'Default delivery options updated for items without specific settings',
        updatedItems: updatedItems.length,
        deliveryOptions: {
          horaEntregaPreferida,
          metodoEntrega,
          notasEntrega,
          tipoEntrega: finalTipoEntrega
        },
        deliveryInfo: {
          type: finalTipoEntrega,
          description: finalTipoEntrega === 'siguiente_dia' ? 
            'Entrega programada para el día siguiente' : 
            'Entrega estándar (2-3 días hábiles)'
        }
      });
    }
  } catch (error) {
    console.error('Update delivery options error:', error);
    res.status(500).json({
      error: 'Failed to update delivery options',
      message: error.message
    });
  }
};

// Función para remover cupón del carrito
const removeCoupon = async (req, res) => {
  try {
    const userId = req.user.id;

    // Remover cupón del carrito
    const removeResult = await removeCartCoupon(userId);
    if (!removeResult.success) {
      return res.status(500).json({
        error: 'Failed to remove coupon',
        message: removeResult.error
      });
    }

    // Obtener carrito actualizado sin cupón
    const { cartItems } = await getCartItemsWithVariations(userId, { includePagination: false });
    const cartTotals = calculateCartTotals(cartItems);
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, cartItems);
    const total = cartTotals.subtotal + cartTotals.totalTaxes + cartTotals.totalConsigne + shippingResult.cost;

    console.log('🗑️ Coupon removed from cart');

    res.json({
      message: 'Coupon removed successfully',
      cartSummary: {
        subtotal: cartTotals.subtotal,
        totalTPS: cartTotals.totalTPS,
        totalTVQ: cartTotals.totalTVQ,
        totalConsigne: cartTotals.totalConsigne,
        totalTaxes: cartTotals.totalTaxes,
        shippingCost: shippingResult.cost,
        shippingMessage: shippingResult.message,
        needsAddress: shippingResult.needsAddress,
        discountAmount: 0,
        total,
        itemCount: cartItems.length,
        freeShippingApplied: false,
        savings: 0
      }
    });
  } catch (error) {
    console.error('Remove coupon error:', error);
    res.status(500).json({
      error: 'Failed to remove coupon',
      message: error.message
    });
  }
};

export {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  getCartWithCoupon,
  updateDeliveryOptions
};
