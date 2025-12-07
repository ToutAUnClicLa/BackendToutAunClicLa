import stripe from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendOrderConfirmationEmail, sendPaymentFailedEmail, sendAdminOrderNotification, sendRestaurantOrderEmail } from '../services/emailService.js';
import { calculateAdvancedShippingCostForCart, calculateShippingCostAdvanced, determineZoneFromPostalCode } from '../utils/shippingCalculator.js';

// ============================================================================
// STRIPE CHECKOUT - CONTROLADOR SIMPLIFICADO
// Solo las funciones esenciales para el flujo Stripe Checkout
// ============================================================================

/**
 * Crea una Stripe Checkout Session
 * Esta es la ÚNICA función que necesitas para crear un pago
 */
const createCheckoutSession = async (req, res) => {
  console.log('🚀 STRIPE CHECKOUT: Starting session creation');
  console.log('🚀 User ID:', req.user?.id);
  console.log('🚀 Request body:', req.body);
  
  try {
    const userId = req.user.id;
    const { shipping_address_id, coupon_code = null, success_url, cancel_url } = req.body;

    // 🚨 SECURITY FIX: Improved address validation with race condition handling
    console.log('🏠 STRIPE CHECKOUT: Validating address:', {
      shipping_address_id,
      userId,
      timestamp: new Date().toISOString()
    });

    // Primary validation: Check if address exists and belongs to user
    const { data: shippingAddress, error: addressError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('*')
      .eq('id', shipping_address_id)
      .eq('usuario_id', userId)
      .single();

    if (addressError || !shippingAddress) {
      console.error('❌ STRIPE CHECKOUT: Address validation failed', {
        shipping_address_id,
        userId,
        addressError: addressError?.message,
        addressFound: !!shippingAddress
      });
      
      // 🔍 DEBUG: Additional address lookup for troubleshooting
      const { data: debugAddress } = await supabaseAdmin
        .from('direcciones_envio')
        .select('id, usuario_id, direccion, created_at')
        .eq('id', shipping_address_id);
      
      console.error('🔍 DEBUG: Address lookup result:', debugAddress);
      
      return res.status(400).json({
        error: 'Invalid shipping address',
        message: 'Please select a valid shipping address',
        debug: {
          addressId: shipping_address_id,
          userId: userId,
          addressExists: !!debugAddress?.[0],
          ownershipMatch: debugAddress?.[0]?.usuario_id === userId
        }
      });
    }

    console.log('✅ STRIPE CHECKOUT: Address validation successful:', {
      addressId: shippingAddress.id,
      userOwnership: shippingAddress.usuario_id === userId,
      city: shippingAddress.ciudad,
      postalCode: shippingAddress.codigo_postal
    });

    // Obtener items del carrito con detalles del producto y variaciones
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(
          id, nombre, precio, stock, "TPS", "TVQ", consigne, categoria_id, subcategoria_id
        ),
        cart_item_variations(
          id,
          variation_id,
          quantity,
          product_variations(
            id,
            name,
            price_modifier,
            variation_groups(group_name)
          )
        )
      `)
      .eq('usuario_id', userId);

    console.log('🛒 Cart query result:', { cartError, itemCount: cartItems?.length || 0 });
    if (cartItems?.length > 0) {
      console.log('🛒 First cart item sample:', JSON.stringify(cartItems[0], null, 2));
    }

    if (cartError || !cartItems || cartItems.length === 0) {
      console.log('❌ Empty cart or error:', cartError);
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Your cart is empty. Add items before checkout.'
      });
    }

    // Validar stock disponible
    for (const item of cartItems) {
      if (item.productos.stock < item.cantidad) {
        return res.status(400).json({
          error: 'Insufficient stock',
          message: `Only ${item.productos.stock} units of ${item.productos.nombre} available`
        });
      }
    }

    // Calcular totales incluyendo variaciones
    let subtotal = 0;
    let totalTPS = 0;
    let totalTVQ = 0;
    let totalConsigne = 0;
    
    const orderItems = cartItems.map(item => {
      const product = item.productos;
      
      // Calcular precio base del producto
      const basePrice = parseFloat(product.precio || 0);
      
      // Calcular modificadores de precio por variaciones
      let variationModifier = 0;
      if (item.cart_item_variations && item.cart_item_variations.length > 0) {
        variationModifier = item.cart_item_variations.reduce((sum, cartVar) => {
          const priceModifier = parseFloat(cartVar.product_variations?.price_modifier || 0);
          return sum + (priceModifier * cartVar.quantity);
        }, 0);
      }
      
      // Precio final por unidad (base + modificadores)
      const finalUnitPrice = basePrice + variationModifier;
      const itemSubtotal = finalUnitPrice * item.cantidad;
      
      // Calcular impuestos sobre el precio final
      const itemTPS = product.TPS ? (itemSubtotal * (parseFloat(product.TPS) / 100)) : 0;
      const itemTVQ = product.TVQ ? (itemSubtotal * (parseFloat(product.TVQ) / 100)) : 0;
      const itemConsigne = product.consigne ? (parseFloat(product.consigne) * item.cantidad) : 0;
      
      subtotal += itemSubtotal;
      totalTPS += itemTPS;
      totalTVQ += itemTVQ;
      totalConsigne += itemConsigne;
      
      return {
        producto_id: product.id,
        cantidad: item.cantidad,
        precio_unitario: basePrice,
        precio_con_variaciones: finalUnitPrice,
        variation_modifier: variationModifier,
        subtotal: itemSubtotal,
        tps: itemTPS,
        tvq: itemTVQ,
        consigne: itemConsigne,
        variations: item.cart_item_variations || []
      };
    });

    // Calcular costo de envío
    const shippingCost = await calculateShippingCostAdvanced(userId, cartItems, shippingAddress);
    let finalShippingCost = shippingCost;
    
    // Aplicar cupón usando la misma lógica del carrito
    let discount = 0;
    let couponData = null;
    let freeShipping = false;
    
    console.log('🚚 STRIPE CHECKOUT - Shipping calculation:', {
      shippingCost: shippingCost.toFixed(2)
    });
    
    if (coupon_code) {
      // Buscar cupón con lógica robusta (igual que en cartController)
      const { data: coupons } = await supabaseAdmin
        .from('cupones')
        .select('*')
        .ilike('codigo', coupon_code.toUpperCase().trim());
      
      const coupon = coupons && coupons.length > 0 ? coupons[0] : null;

      if (coupon && coupon.activo !== false && (!coupon.fecha_expiracion || new Date(coupon.fecha_expiracion) >= new Date())) {
        
        // Check user usage limits - limite_usos now represents uses per user
        let canUseCoupon = true;
        if (coupon.limite_usos !== null) {
          const { data: userUsages } = await supabaseAdmin
            .from('cupones_usos')
            .select('id')
            .eq('cupon_id', coupon.id)
            .eq('usuario_id', userId);

          const userUsageCount = userUsages ? userUsages.length : 0;
          canUseCoupon = userUsageCount < coupon.limite_usos;
        }

        if (canUseCoupon) {
          // Detectar tipo de cupón (misma lógica que cartController)
          const isShippingCoupon = coupon.codigo.startsWith('ENVIO') || 
                                  coupon.codigo.startsWith('SHIP') ||
                                  (coupon.descuento == 0);
          
          if (isShippingCoupon) {
            // Cupón de envío gratis
            freeShipping = true;
            finalShippingCost = 0;
            console.log('💳 Cupón de envío gratis aplicado');
            couponData = {
              ...coupon,
              type: 'free_shipping',
              description: 'Envío gratis'
            };
          } else {
            // Cupón de descuento - aplicar sobre total completo
            const totalBeforeDiscount = subtotal + totalTPS + totalTVQ + totalConsigne + finalShippingCost;
            discount = (totalBeforeDiscount * coupon.descuento) / 100;
            couponData = {
              ...coupon,
              type: 'discount',
              description: `${coupon.descuento}% de descuento`
            };
          }
        }
      }
    }
    
    // Calcular total final con lógica correcta
    const totalBeforeDiscount = subtotal + totalTPS + totalTVQ + totalConsigne + finalShippingCost;
    const totalAmount = Math.max(0, totalBeforeDiscount - discount);

    if (totalAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid total amount',
        message: 'Total amount must be greater than 0'
      });
    }

    // Obtener o crear customer de Stripe
    let stripeCustomerId = await getOrCreateStripeCustomer(userId);

    // Crear line items para Stripe Checkout incluyendo variaciones
    const lineItems = cartItems.map(item => {
      const product = item.productos;
      const basePrice = parseFloat(product.precio || 0);
      
      // Calcular precio con variaciones
      let variationModifier = 0;
      let variationNames = [];
      if (item.cart_item_variations && item.cart_item_variations.length > 0) {
        variationModifier = item.cart_item_variations.reduce((sum, cartVar) => {
          const priceModifier = parseFloat(cartVar.product_variations?.price_modifier || 0);
          const variationName = cartVar.product_variations?.name;
          const groupName = cartVar.product_variations?.variation_groups?.group_name;
          
          if (variationName) {
            const displayName = groupName ? `${groupName}: ${variationName}` : variationName;
            if (cartVar.quantity > 1) {
              variationNames.push(`${displayName} (x${cartVar.quantity})`);
            } else {
              variationNames.push(displayName);
            }
          }
          
          return sum + (priceModifier * cartVar.quantity);
        }, 0);
      }
      
      const finalUnitPrice = basePrice + variationModifier;
      const unitAmount = Math.round(finalUnitPrice * 100); // Convertir a centavos
      
      // Nombre del producto con variaciones
      const productName = variationNames.length > 0 
        ? `${product.nombre} (${variationNames.join(', ')})` 
        : product.nombre;
      
      return {
        price_data: {
          currency: 'cad',
          product_data: {
            name: productName,
            metadata: {
              producto_id: product.id.toString(),
              has_variations: (item.cart_item_variations?.length > 0).toString(),
              variation_modifier: variationModifier.toString()
            }
          },
          unit_amount: unitAmount,
        },
        quantity: item.cantidad,
      };
    });

    // Agregar envío como line item si aplica (usar finalShippingCost)
    if (finalShippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: freeShipping ? 'Envío (GRATIS con cupón)' : 'Envío'
          },
          unit_amount: Math.round(finalShippingCost * 100)
        },
        quantity: 1
      });
    } else if (finalShippingCost > 0 && freeShipping) {
      // Mostrar envío gratis como línea con $0 para transparencia
      const shippingName = `Envío (GRATIS con cupón - ahorro $${finalShippingCost.toFixed(2)})`;
      
      lineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: shippingName
          },
          unit_amount: 0
        },
        quantity: 1
      });
    }

    // Agregar impuestos como line items
    if (totalTPS > 0) {
      lineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'TPS (Impuesto Federal)'
          },
          unit_amount: Math.round(totalTPS * 100)
        },
        quantity: 1
      });
    }

    if (totalTVQ > 0) {
      lineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'TVQ (Impuesto Provincial)'
          },
          unit_amount: Math.round(totalTVQ * 100)
        },
        quantity: 1
      });
    }

    // Agregar fees de consigne si aplica
    if (totalConsigne > 0) {
      lineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'Tarifa de Depósito'
          },
          unit_amount: Math.round(totalConsigne * 100)
        },
        quantity: 1
      });
    }

    // Para descuentos, usamos discounts en lugar de line items negativos
    let discounts = [];
    if (discount > 0 && couponData?.type === 'discount') {
      // Crear un cupón de Stripe on-the-fly para el descuento
      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(discount * 100),
        currency: 'cad',
        name: `${couponData.descuento}% de descuento (${couponData.codigo})`,
        duration: 'once'
      });
      
      discounts = [{
        coupon: stripeCoupon.id
      }];
    }

    // Crear Stripe Checkout Session
    const sessionConfig = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: success_url || `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/checkout/cancel`,
      metadata: {
        user_id: userId,
        shipping_address_id: shipping_address_id,
        coupon_code: coupon_code || '',
        coupon_type: couponData?.type || '',
        subtotal: subtotal.toFixed(2),
        tps: totalTPS.toFixed(2),
        tvq: totalTVQ.toFixed(2),
        consigne: totalConsigne.toFixed(2),
        shipping_cost: finalShippingCost.toFixed(2),
        free_shipping: freeShipping.toString(),
        discount: discount.toFixed(2),
        total: totalAmount.toFixed(2)
      }
    };

    // Agregar descuentos si aplica
    if (discounts.length > 0) {
      sessionConfig.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('✅ Stripe Checkout Session creada:', {
      sessionId: session.id,
      userId: userId,
      total: totalAmount,
      items: cartItems.length,
      couponApplied: couponData ? {
        code: couponData.codigo,
        type: couponData.type,
        discount: discount,
        freeShipping: freeShipping,
        originalShipping: finalShippingCost,
        finalShipping: finalShippingCost
      } : null
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url, // Esta es la URL de Stripe donde redirigir
      orderSummary: {
        items: orderItems,
        subtotal: subtotal.toFixed(2),
        tps: totalTPS.toFixed(2),
        tvq: totalTVQ.toFixed(2),
        consigne: totalConsigne.toFixed(2),
        shippingCost: finalShippingCost.toFixed(2),
        freeShipping: freeShipping,
        discount: discount.toFixed(2),
        total: totalAmount.toFixed(2),
        coupon: couponData,
        savings: (discount + (freeShipping && finalShippingCost > 0 ? finalShippingCost : 0)).toFixed(2),
        shippingAddress
      }
    });

  } catch (error) {
    console.error('❌ Error creando checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
};

/**
 * Obtiene el estado de una Stripe Checkout Session
 * Usado en la página de success para verificar el pago
 */
const getCheckoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verificar que la session pertenece al usuario
    if (session.metadata.user_id !== userId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Checkout session does not belong to current user'
      });
    }

    // Obtener la orden si existe
    const { data: order } = await supabaseAdmin
      .from('pedidos')
      .select('id, estado, total, fecha_pedido')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    res.json({
      sessionId: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total / 100,
      currency: session.currency,
      customer_email: session.customer_email,
      metadata: session.metadata,
      order: order || null
    });

  } catch (error) {
    console.error('❌ Error obteniendo estado de checkout session:', error);
    res.status(500).json({
      error: 'Failed to get checkout session status',
      message: error.message
    });
  }
};

/**
 * Crea una orden desde una Stripe Checkout Session completada
 * Esta función es llamada automáticamente por el webhook
 */
const createOrderFromCheckoutSession = async (session) => {
  console.log('🏗️ Creando orden desde checkout session:', {
    sessionId: session.id,
    metadata: session.metadata,
    paymentStatus: session.payment_status,
    paymentIntent: session.payment_intent
  });

  try {
    const userId = session.metadata.user_id;
    const shippingAddressId = session.metadata.shipping_address_id;
    
    // Obtener items del carrito con información completa de entrega y variaciones
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(id, nombre, precio, stock, subcategoria_id),
        cart_item_variations(
          id,
          variation_id,
          quantity,
          product_variations(
            id,
            name,
            price_modifier,
            variation_groups(group_name)
          )
        )
      `)
      .eq('usuario_id', userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      console.error('❌ Carrito vacío o no encontrado:', { cartError, itemsFound: cartItems?.length });
      throw new Error(`Cart is empty or not found. Error: ${cartError?.message}, Items: ${cartItems?.length}`);
    }

    // Validar stock
    for (const item of cartItems) {
      if (item.productos.stock < item.cantidad) {
        throw new Error(`Insufficient stock for ${item.productos.nombre}`);
      }
    }

    // Parsear metadata de Stripe
    const totalAmount = parseFloat(session.metadata.total);
    const subtotal = parseFloat(session.metadata.subtotal);
    const tps = parseFloat(session.metadata.tps);
    const tvq = parseFloat(session.metadata.tvq);
    const consigne = parseFloat(session.metadata.consigne || 0);
    const shippingCost = parseFloat(session.metadata.shipping_cost);
    const freeShipping = session.metadata.free_shipping === 'true';
    const discount = parseFloat(session.metadata.discount);
    const couponCode = session.metadata.coupon_code || null;
    const couponType = session.metadata.coupon_type || null;

    // Extraer información de entrega de los items del carrito
    // Todos los items deben tener las mismas opciones de entrega (una sola entrega)
    const deliveryInfo = cartItems.length > 0 ? {
      metodoEntrega: cartItems[0].metodo_entrega || 'puerta',
      notasEntrega: cartItems[0].notas_entrega
    } : {
      metodoEntrega: 'puerta',
      notasEntrega: null
    };

    // Determinar si el envío es gratis por umbral ($200) o por cupón
    const envioGratisPorUmbral = subtotal >= 200;
    const envioGratisPorCupon = freeShipping && couponType === 'free_shipping';
    const envioGratisTotal = envioGratisPorUmbral || envioGratisPorCupon;

    // Crear notas completas con información de entrega
    let notasCompletas = [];

    // Agregar información de entrega
    notasCompletas.push(`--- INFORMACIÓN DE ENTREGA ---`);
    notasCompletas.push(`Método: ${deliveryInfo.metodoEntrega}`);
    if (deliveryInfo.notasEntrega) {
      notasCompletas.push(`Notas del repartidor: ${deliveryInfo.notasEntrega}`);
    }
    
    // Agregar información de cupón si aplica
    if (couponCode) {
      notasCompletas.push(`--- INFORMACIÓN DE CUPÓN ---`);
      notasCompletas.push(`Código: ${couponCode}`);
      notasCompletas.push(`Tipo: ${couponType === 'free_shipping' ? 'Envío gratis' : 'Descuento porcentual'}`);
      if (couponType === 'free_shipping') {
        notasCompletas.push(`Ahorro en envío: $${shippingCost.toFixed(2)}`);
      } else if (discount > 0) {
        notasCompletas.push(`Descuento aplicado: $${discount.toFixed(2)}`);
      }
    }
    
    // Agregar información de envío
    notasCompletas.push(`--- INFORMACIÓN DE ENVÍO ---`);
    notasCompletas.push(`Costo de envío: $${shippingCost.toFixed(2)}`);
    if (envioGratisPorUmbral) {
      notasCompletas.push(`Envío gratis por compra mayor a $200 CAD`);
    }
    if (envioGratisPorCupon) {
      notasCompletas.push(`Envío gratis aplicado por cupón`);
    }

    // Crear orden con toda la información
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        usuario_id: userId,
        total: totalAmount,
        estado: 'pagado',
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        direccion_envio_id: shippingAddressId || null,
        subtotal: subtotal,
        impuestos_tps: tps,
        impuestos_tvq: tvq,
        costos_envio: shippingCost,
        descuento: discount,
        codigo_cupon: couponCode,
        fecha_pago: new Date().toISOString(),
        // Campos de entrega
        metodo_entrega: deliveryInfo.metodoEntrega,
        notas_entrega: deliveryInfo.notasEntrega,
        tipo_cupon: couponType,
        envio_gratis: envioGratisTotal,
        costo_envio_original: shippingCost,
        aplicado_envio_gratis: envioGratisPorCupon,
        // Notas completas con toda la información
        notas: notasCompletas.join('\n')
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Crear detalles de la orden
    const orderDetails = cartItems.map(item => {
      const basePrice = parseFloat(item.productos.precio || 0);
      let variationModifier = 0;
      
      // Calcular modificador por variaciones
      if (item.cart_item_variations && item.cart_item_variations.length > 0) {
        variationModifier = item.cart_item_variations.reduce((sum, cartVar) => {
          const priceModifier = parseFloat(cartVar.product_variations?.price_modifier || 0);
          return sum + (priceModifier * cartVar.quantity);
        }, 0);
      }
      
      const finalUnitPrice = basePrice + variationModifier;
      
      return {
        pedido_id: order.id,
        producto_id: item.productos.id,
        cantidad: item.cantidad,
        precio_unitario: finalUnitPrice
      };
    });

    const { data: insertedDetails, error: detailsError } = await supabaseAdmin
      .from('detalles_pedido')
      .insert(orderDetails)
      .select('id');

    if (detailsError) {
      throw detailsError;
    }

    // Crear variaciones de los items de la orden
    const orderItemVariations = [];
    cartItems.forEach((item, itemIndex) => {
      if (item.cart_item_variations && item.cart_item_variations.length > 0) {
        const orderDetailId = insertedDetails[itemIndex].id;
        
        item.cart_item_variations.forEach(cartVar => {
          orderItemVariations.push({
            order_detail_id: orderDetailId,
            variation_id: cartVar.variation_id,
            quantity: cartVar.quantity,
            price_modifier: parseFloat(cartVar.product_variations?.price_modifier || 0)
          });
        });
      }
    });

    // Insertar variaciones si existen
    if (orderItemVariations.length > 0) {
      const { error: variationsError } = await supabaseAdmin
        .from('order_item_variations')
        .insert(orderItemVariations);

      if (variationsError) {
        console.error('⚠️ Error insertando variaciones de la orden:', variationsError);
        // No fallar la orden si las variaciones fallan, pero logear el error
      } else {
        console.log('✅ Variaciones de orden guardadas:', orderItemVariations.length);
      }
    }

    // Actualizar stock de productos
    for (const item of cartItems) {
      await supabaseAdmin
        .from('productos')
        .update({ 
          stock: item.productos.stock - item.cantidad 
        })
        .eq('id', item.productos.id);
    }

    // Limpiar carrito del usuario
    await supabaseAdmin
      .from('carrito')
      .delete()
      .eq('usuario_id', userId);

    // Si se usó un cupón, registrar el uso e incrementar contador
    if (couponCode) {
      try {
        // Buscar el cupón para obtener su ID
        const { data: couponData } = await supabaseAdmin
          .from('cupones')
          .select('id, limite_usos')
          .ilike('codigo', couponCode.toUpperCase().trim())
          .single();

        if (couponData) {
          // Registrar el uso del cupón por el usuario
          await supabaseAdmin
            .from('cupones_usos')
            .insert({
              cupon_id: couponData.id,
              usuario_id: userId,
              pedido_id: order.id,
              ip_usuario: null // Puedes obtener la IP del request si es necesario
            });

          console.log('✅ Uso de cupón registrado:', {
            couponCode,
            couponId: couponData.id,
            userId,
            orderId: order.id,
            type: couponType
          });
        }
      } catch (couponError) {
        console.error('⚠️ Error registrando uso de cupón:', couponError);
        // No fallar la orden si el registro del cupón falla
      }
    }

    // Enviar emails
    try {
      // Email al cliente
      await sendOrderConfirmationEmail(order.id);
      console.log('✅ Email de confirmación enviado al cliente');

      // Delay para evitar rate limit de Resend (2 emails/segundo)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Email al admin
      await sendAdminOrderNotification(order.id);
      console.log('✅ Email de notificación enviado al admin');

      // Delay para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 600));

      // Enviar emails a restaurantes si hay productos de restaurantes
      const restaurantIds = new Set();
      console.log('🔍 Buscando restaurantes en items del carrito...');

      for (const cartItem of cartItems) {
        if (cartItem.productos?.subcategoria_id) {
          console.log(`📦 Producto: ${cartItem.productos.nombre}, Subcategoría: ${cartItem.productos.subcategoria_id}`);

          // Verificar si la subcategoría es un restaurante (categoria_id = 2)
          const { data: subcategoria } = await supabaseAdmin
            .from('subcategorias')
            .select('id, nombre, categoria_id, gmail')
            .eq('id', cartItem.productos.subcategoria_id)
            .single();

          if (subcategoria) {
            console.log(`🏪 Subcategoría encontrada: ${subcategoria.nombre}, Categoría: ${subcategoria.categoria_id}, Email: ${subcategoria.gmail}`);

            if (subcategoria.categoria_id === 2 && subcategoria.gmail) {
              restaurantIds.add(subcategoria.id);
              console.log(`✅ Restaurante agregado: ${subcategoria.nombre} (${subcategoria.gmail})`);
            }
          }
        }
      }

      console.log(`🍽️ Total restaurantes únicos encontrados: ${restaurantIds.size}`);
      console.log('🍽️ IDs de restaurantes:', Array.from(restaurantIds));

      // Enviar email a cada restaurante único con delay entre cada uno
      for (const restaurantId of restaurantIds) {
        try {
          console.log(`📧 Enviando email al restaurante ID: ${restaurantId}`);
          const result = await sendRestaurantOrderEmail(order.id, restaurantId);
          if (result.success) {
            console.log(`✅ Email enviado exitosamente al restaurante: ${result.restaurant} (${result.email})`);
            console.log(`🎯 Email ID: ${result.emailId}`);
          } else {
            console.error(`❌ Error en sendRestaurantOrderEmail:`, result);
          }

          // Delay para evitar rate limit entre emails de restaurantes
          await new Promise(resolve => setTimeout(resolve, 600));
        } catch (restError) {
          console.error(`⚠️ Error enviando email al restaurante ${restaurantId}:`, restError);
        }
      }

      if (restaurantIds.size === 0) {
        console.log('📄 No se encontraron productos de restaurantes en esta orden');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando emails:', emailError);
      // No fallar la orden si los emails fallan
    }

    console.log('✅ Orden creada exitosamente:', order.id);
    return order;
    
  } catch (error) {
    console.error('❌ Error creando orden desde checkout session:', error);
    throw error;
  }
};

/**
 * Maneja los webhooks de Stripe
 * Solo procesa eventos de Stripe Checkout
 */
const handleWebhook = async (req, res) => {
  console.log('🔄 Webhook recibido:', {
    method: req.method,
    url: req.url,
    contentType: req.headers['content-type'],
    bodyType: typeof req.body,
    bodyIsBuffer: Buffer.isBuffer(req.body),
    bodyLength: req.body?.length,
    hasSignature: !!req.headers['stripe-signature'],
    userAgent: req.headers['user-agent'],
    rawBodySample: req.body ? req.body.toString().substring(0, 100) + '...' : 'NO BODY'
  });

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Debug adicional
  console.log('🔑 Webhook Secret configurado:', endpointSecret ? `${endpointSecret.substring(0, 10)}...` : 'NO CONFIGURADO');
  console.log('🖊️ Signature recibida:', sig ? `${sig.substring(0, 20)}...` : 'NO RECIBIDA');

  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET no está configurado');
    return res.status(500).send('Webhook secret not configured');
  }

  if (!sig) {
    console.error('❌ Header stripe-signature no recibido');
    return res.status(400).send('No stripe signature header');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook verificado exitosamente:', event.type, event.id);
  } catch (err) {
    console.error('❌ ERROR DETALLADO DE VERIFICACIÓN:', {
      message: err.message,
      type: err.type || 'unknown',
      detail: err.detail || 'no detail',
      code: err.code || 'no code'
    });
    
    // Casos específicos de error
    if (err.message.includes('timestamp')) {
      console.error('🕐 Error de timestamp - webhook muy antiguo o tiempo de servidor incorrecto');
    } else if (err.message.includes('signature')) {
      console.error('🔒 Error de firma - STRIPE_WEBHOOK_SECRET no coincide con Stripe Dashboard');
    }
    
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log('🎯 Procesando evento webhook:', event.type, 'ID:', event.id);
    
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('✅ Checkout session completada:', session.id);
        
        // Verificar si la orden ya existe
        const { data: existingOrder, error: checkError } = await supabaseAdmin
          .from('pedidos')
          .select('id')
          .eq('stripe_checkout_session_id', session.id)
          .single();

        if (!existingOrder) {
          try {
            console.log('🏗️ Creando nueva orden...');
            const order = await createOrderFromCheckoutSession(session);
            console.log(`✅ Orden ${order.id} creada desde checkout session ${session.id}`);
          } catch (orderError) {
            console.error('❌ Error creando orden:', orderError);
          }
        } else {
          console.log(`⚠️ Orden ya existe para checkout session ${session.id}`);
        }
        break;

      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        console.log('⌛ Checkout session expirada:', expiredSession.id);
        // Solo logear, no necesitas hacer nada más
        break;

      default:
        console.log(`⚠️ Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
    
  } catch (error) {
    console.error('❌ Error manejando webhook:', error);
    res.status(500).json({
      error: 'Webhook handler failed',
      message: error.message
    });
  }
};

/**
 * Crear reembolso (función opcional para admin)
 */
const createRefund = async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;
    
    // Crear reembolso en Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason
    });

    // Actualizar estado de la orden
    await supabaseAdmin
      .from('pedidos')
      .update({ 
        estado: amount ? 'parcialmente_reembolsado' : 'reembolsado',
        fecha_reembolso: new Date().toISOString(),
        monto_reembolso: refund.amount / 100
      })
      .eq('stripe_payment_intent_id', paymentIntentId);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason
      }
    });

  } catch (error) {
    console.error('❌ Error creando reembolso:', error);
    res.status(500).json({
      error: 'Failed to create refund',
      message: error.message
    });
  }
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Calcula el costo de envío basado en ubicación y tipos de productos
 */
const calculateShippingCost = async (userId, cartItems, shippingAddress) => {
  // Usar la función centralizada del calculador de envío
  return await calculateShippingCostAdvanced(userId, cartItems, shippingAddress);
};


/**
 * Obtiene o crea un customer de Stripe
 * Verifica que el customer ID sea válido en el entorno actual
 */
const getOrCreateStripeCustomer = async (userId) => {
  const { data: user, error } = await supabaseAdmin
    .from('usuarios')
    .select('stripe_customer_id, correo_electronico, nombre')
    .eq('id', userId)
    .single();

  if (error) throw error;

  // Si hay un customer ID almacenado, verificar que existe en el entorno actual
  if (user.stripe_customer_id) {
    try {
      // Intentar obtener el customer de Stripe para verificar que existe
      await stripe.customers.retrieve(user.stripe_customer_id);
      return user.stripe_customer_id;
    } catch (stripeError) {
      console.warn('⚠️ Customer ID almacenado no es válido en el entorno actual:', {
        userId,
        storedCustomerId: user.stripe_customer_id,
        error: stripeError.message
      });
      // El customer ID no es válido, crear uno nuevo
    }
  }

  // Crear nuevo customer en Stripe
  const customer = await stripe.customers.create({
    email: user.correo_electronico,
    name: user.nombre,
    metadata: {
      user_id: userId
    }
  });

  console.log('✅ Nuevo customer de Stripe creado:', {
    userId,
    customerId: customer.id,
    email: user.correo_electronico
  });

  // Actualizar usuario con el nuevo Stripe customer ID
  await supabaseAdmin
    .from('usuarios')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
};

export {
  createCheckoutSession,
  getCheckoutSessionStatus,
  handleWebhook,
  createRefund,
  createOrderFromCheckoutSession
};