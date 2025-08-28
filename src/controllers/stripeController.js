import stripe from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendOrderConfirmationEmail, sendPaymentFailedEmail, sendAdminOrderNotification } from '../services/emailService.js';

// ============================================================================
// STRIPE CHECKOUT - CONTROLADOR SIMPLIFICADO
// Solo las funciones esenciales para el flujo Stripe Checkout
// ============================================================================

/**
 * Crea una Stripe Checkout Session
 * Esta es la ÚNICA función que necesitas para crear un pago
 */
const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shipping_address_id, coupon_code = null, success_url, cancel_url } = req.body;

    // Validar dirección de envío
    const { data: shippingAddress, error: addressError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('*')
      .eq('id', shipping_address_id)
      .eq('usuario_id', userId)
      .single();

    if (addressError || !shippingAddress) {
      return res.status(400).json({
        error: 'Invalid shipping address',
        message: 'Please select a valid shipping address'
      });
    }

    // Obtener items del carrito con detalles del producto
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(
          id, nombre, precio, stock, "TPS", "TVQ", consigne
        )
      `)
      .eq('usuario_id', userId);

    if (cartError || !cartItems || cartItems.length === 0) {
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

    // Calcular totales
    let subtotal = 0;
    let totalTPS = 0;
    let totalTVQ = 0;
    let totalConsigne = 0;
    
    const orderItems = cartItems.map(item => {
      const product = item.productos;
      const itemSubtotal = parseFloat(product.precio) * item.cantidad;
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
        precio_unitario: product.precio,
        subtotal: itemSubtotal,
        tps: itemTPS,
        tvq: itemTVQ,
        consigne: itemConsigne
      };
    });

    // Aplicar cupón usando la misma lógica del carrito
    let discount = 0;
    let couponData = null;
    let freeShipping = false;
    let originalShippingCost = 0;
    
    // Calcular costo de envío original
    originalShippingCost = calculateShippingCost(shippingAddress, subtotal);
    let finalShippingCost = originalShippingCost;
    
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
            couponData = {
              ...coupon,
              type: 'free_shipping',
              description: 'Envío gratis'
            };
          } else {
            // Cupón de descuento - aplicar sobre total completo
            const totalBeforeDiscount = subtotal + totalTPS + totalTVQ + totalConsigne + originalShippingCost;
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

    // Crear line items para Stripe Checkout
    const lineItems = cartItems.map(item => {
      const product = item.productos;
      const unitAmount = Math.round(parseFloat(product.precio) * 100); // Convertir a centavos
      
      return {
        price_data: {
          currency: 'cad',
          product_data: {
            name: product.nombre,
            metadata: {
              producto_id: product.id.toString()
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
    } else if (originalShippingCost > 0 && freeShipping) {
      // Mostrar envío gratis como línea con $0 para transparencia
      lineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `Envío (GRATIS con cupón - ahorro $${originalShippingCost.toFixed(2)})`
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
        original_shipping_cost: originalShippingCost.toFixed(2),
        shipping_cost: finalShippingCost.toFixed(2),
        free_shipping: freeShipping.toString(),
        discount: discount.toFixed(2),
        total: totalAmount.toFixed(2)
      },
      shipping_address_collection: {
        allowed_countries: ['CA', 'US']
      },
      phone_number_collection: {
        enabled: true
      },
      customer_update: {
        address: 'auto',
        name: 'auto'
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
        originalShipping: originalShippingCost,
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
        originalShippingCost: originalShippingCost.toFixed(2),
        shippingCost: finalShippingCost.toFixed(2),
        freeShipping: freeShipping,
        discount: discount.toFixed(2),
        total: totalAmount.toFixed(2),
        coupon: couponData,
        savings: (discount + (freeShipping && originalShippingCost > 0 ? originalShippingCost : 0)).toFixed(2),
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
    
    // Obtener items del carrito con información completa de entrega
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(id, nombre, precio, stock)
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
    const originalShippingCost = parseFloat(session.metadata.original_shipping_cost || 0);
    const shippingCost = parseFloat(session.metadata.shipping_cost);
    const freeShipping = session.metadata.free_shipping === 'true';
    const discount = parseFloat(session.metadata.discount);
    const couponCode = session.metadata.coupon_code || null;
    const couponType = session.metadata.coupon_type || null;

    // Extraer información de entrega de los items del carrito
    // Todos los items deben tener las mismas opciones de entrega (una sola entrega)
    const deliveryInfo = cartItems.length > 0 ? {
      horaEntregaPreferida: cartItems[0].hora_entrega_preferida,
      metodoEntrega: cartItems[0].metodo_entrega || 'puerta',
      notasEntrega: cartItems[0].notas_entrega,
      tipoEntrega: cartItems[0].tipo_entrega || 'estandar'
    } : {
      horaEntregaPreferida: '18:00',
      metodoEntrega: 'puerta', 
      notasEntrega: null,
      tipoEntrega: 'estandar'
    };

    // Determinar si el envío es gratis por umbral ($200) o por cupón
    const envioGratisPorUmbral = subtotal >= 200;
    const envioGratisPorCupon = freeShipping && couponType === 'free_shipping';
    const envioGratisTotal = envioGratisPorUmbral || envioGratisPorCupon;

    // Crear notas completas con información de entrega
    let notasCompletas = [];
    
    // Agregar información de entrega
    notasCompletas.push(`--- INFORMACIÓN DE ENTREGA ---`);
    notasCompletas.push(`Tipo: ${deliveryInfo.tipoEntrega === 'siguiente_dia' ? 'Entrega al día siguiente' : 'Entrega estándar (2-3 días hábiles)'}`);
    if (deliveryInfo.horaEntregaPreferida) {
      notasCompletas.push(`Hora preferida: ${deliveryInfo.horaEntregaPreferida}`);
    }
    notasCompletas.push(`Método: ${deliveryInfo.metodoEntrega}`);
    if (deliveryInfo.notasEntrega) {
      notasCompletas.push(`Notas del cliente: ${deliveryInfo.notasEntrega}`);
    }
    
    // Agregar información de cupón si aplica
    if (couponCode) {
      notasCompletas.push(`--- INFORMACIÓN DE CUPÓN ---`);
      notasCompletas.push(`Código: ${couponCode}`);
      notasCompletas.push(`Tipo: ${couponType === 'free_shipping' ? 'Envío gratis' : 'Descuento porcentual'}`);
      if (couponType === 'free_shipping') {
        notasCompletas.push(`Ahorro en envío: $${originalShippingCost.toFixed(2)}`);
      } else if (discount > 0) {
        notasCompletas.push(`Descuento aplicado: $${discount.toFixed(2)}`);
      }
    }
    
    // Agregar información de envío
    notasCompletas.push(`--- INFORMACIÓN DE ENVÍO ---`);
    notasCompletas.push(`Costo original: $${originalShippingCost.toFixed(2)}`);
    notasCompletas.push(`Costo final: $${shippingCost.toFixed(2)}`);
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
        // Nuevos campos de entrega
        hora_entrega_preferida: deliveryInfo.horaEntregaPreferida,
        metodo_entrega: deliveryInfo.metodoEntrega,
        notas_entrega: deliveryInfo.notasEntrega,
        tipo_entrega: deliveryInfo.tipoEntrega,
        tipo_cupon: couponType,
        envio_gratis: envioGratisTotal,
        costo_envio_original: originalShippingCost,
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
    const orderDetails = cartItems.map(item => ({
      pedido_id: order.id,
      producto_id: item.productos.id,
      cantidad: item.cantidad,
      precio_unitario: item.productos.precio
    }));

    const { error: detailsError } = await supabaseAdmin
      .from('detalles_pedido')
      .insert(orderDetails);

    if (detailsError) {
      throw detailsError;
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
      await sendOrderConfirmationEmail(order.id);
      await sendAdminOrderNotification(order.id);
      console.log('✅ Emails de confirmación enviados para orden', order.id);
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
    headers: req.headers,
    bodyLength: req.body?.length,
    hasSignature: !!req.headers['stripe-signature']
  });

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook verificado:', event.type, event.id);
  } catch (err) {
    console.error('❌ Fallo verificación de webhook:', err.message);
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
 * Calcula el costo de envío
 */
const calculateShippingCost = (address, subtotal) => {
  const baseShipping = 8.99;
  const freeShippingThreshold = 200.00; // Envío gratis sobre $200 CAD
  
  if (subtotal >= freeShippingThreshold) {
    return 0;
  }
  
  // Tarifas diferentes por provincia
  const provincialRates = {
    'Quebec': 8.99,
    'MONTREAL': 8.99,
    'Ontario': 12.99,
    'British Columbia': 14.99,
    'Alberta': 13.99,
  };
  
  return provincialRates[address.estado] || baseShipping;
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