import stripe from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendOrderConfirmationEmail, sendPaymentFailedEmail, sendAdminOrderNotification, sendRestaurantOrderEmail } from '../services/emailService.js';
import { calculateAdvancedShippingCostForCart, calculateShippingCostAdvanced, determineZoneFromPostalCode } from '../utils/shippingCalculator.js';
import { calculateCartTotals, validateCoupon, applyCouponToCart } from '../utils/cartHelpers.js';

const applyDiscount = (precio, descuento) => {
  const base = parseFloat(precio || 0);
  const pct = parseFloat(descuento || 0);
  if (!pct || pct <= 0) return base;
  return base * (1 - pct / 100);
};

// ============================================================================
// IMPUESTOS NATIVOS DE STRIPE (TPS / TVQ)
// ----------------------------------------------------------------------------
// Adjuntamos los impuestos como TaxRate de Stripe a cada producto gravable, en
// lugar de mandarlos como líneas sueltas. Así Stripe muestra y reporta cuánto
// impuesto se cobra POR PRODUCTO, y el cliente ve el desglose en el checkout.
// Los TaxRate son inmutables; los creamos una vez por (nombre, %) y cacheamos
// el id en memoria del proceso para reutilizarlos.
// ============================================================================
const taxRateCache = new Map();

const getOrCreateTaxRate = async ({ displayName, percentage }) => {
  const pct = Number(percentage);
  if (!pct || pct <= 0) return null;
  const key = `${displayName}_${pct}`;
  if (taxRateCache.has(key)) return taxRateCache.get(key);

  const taxRate = await stripe.taxRates.create({
    display_name: displayName,           // 'TPS' o 'TVQ' (se ve en el checkout)
    description: `${displayName} ${pct}%`,
    percentage: pct,                     // 5 o 9.975
    inclusive: false,                    // el precio NO incluye impuesto
    country: 'CA',
    ...(displayName === 'TVQ' ? { state: 'QC' } : {})
  });

  taxRateCache.set(key, taxRate.id);
  return taxRate.id;
};

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
          id, nombre, precio, descuento, stock, "TPS", "TVQ", consigne, categoria_id, subcategoria_id
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

    // 4. Calcular totales usando helpers centralizados (Single Source of Truth)
    const cartTotals = calculateCartTotals(cartItems);

    // 5. Calcular costos de envío (incluyendo promociones de fin de semana)
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, cartItems);

    // 5b. Bloquear si la dirección principal está fuera de la zona de cobertura
    if (shippingResult.deliverable === false) {
      return res.status(400).json({
        error: 'Delivery not available',
        message: shippingResult.message || 'No disponible esta ubicación por el momento!'
      });
    }

    const shippingCost = shippingResult.cost;

    // 6. Validar y aplicar cupón
    let appliedCoupon = null;
    if (coupon_code) {
      const couponValidation = await validateCoupon(coupon_code, userId);
      if (couponValidation.valid) {
        appliedCoupon = couponValidation.coupon;
      }
    }

    // 7. Aplicar cupón a los totales (mismo cálculo que en cartController)
    const couponResult = applyCouponToCart(cartTotals, shippingCost, appliedCoupon);

    const subtotal = cartTotals.subtotal;
    const totalTPS = cartTotals.totalTPS;
    const totalTVQ = cartTotals.totalTVQ;
    const totalConsigne = cartTotals.totalConsigne;
    const finalShippingCost = couponResult.finalShippingCost;
    const discount = couponResult.discountAmount;
    const totalAmount = couponResult.total;
    const freeShipping = couponResult.couponType === 'free_shipping';
    const couponData = couponResult.couponInfo;

    // Items formateados para el resumen del pedido
    const orderItems = cartTotals.items.map(item => ({
      producto_id: item.productos.id,
      cantidad: item.cantidad,
      precio_unitario: item.productos.precio_anterior || item.productos.precio,
      subtotal: item.calculatedSubtotal,
      tps: item.taxes.tps,
      tvq: item.taxes.tvq,
      consigne: item.consigne
    }));

    if (totalAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid total amount',
        message: 'Total amount must be greater than 0'
      });
    }

    // Obtener o crear customer de Stripe
    let stripeCustomerId = await getOrCreateStripeCustomer(userId);

    // 8. Crear line items para Stripe Checkout (Sin variaciones)
    // Cada producto lleva sus impuestos (TPS/TVQ) como tax_rates nativos, para
    // que Stripe calcule y reporte el impuesto por producto.
    const lineItems = await Promise.all(cartTotals.items.map(async item => {
      const product = item.productos;

      // Usar el precio ya calculado del item
      const unitAmount = Math.round(item.calculatedPrice * 100); // Convertir a centavos

      // Impuestos por producto según sus tasas (0 = exento, no se adjunta)
      const taxRateIds = [];
      const tpsId = await getOrCreateTaxRate({ displayName: 'TPS', percentage: product.TPS });
      if (tpsId) taxRateIds.push(tpsId);
      const tvqId = await getOrCreateTaxRate({ displayName: 'TVQ', percentage: product.TVQ });
      if (tvqId) taxRateIds.push(tvqId);

      return {
        price_data: {
          currency: 'cad',
          product_data: {
            name: product.nombre,
            metadata: {
              producto_id: product.id.toString(),
            }
          },
          unit_amount: unitAmount,
        },
        quantity: item.cantidad,
        ...(taxRateIds.length > 0 ? { tax_rates: taxRateIds } : {})
      };
    }));

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

    // Los impuestos (TPS/TVQ) ya van como tax_rates nativos en cada producto,
    // por lo que NO se agregan como líneas separadas (Stripe los calcula).

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

    // Obtener items del carrito con información completa de entrega
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(id, nombre, precio, descuento, stock, subcategoria_id)
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

    // Montos autoritativos desde Stripe: la factura debe reflejar EXACTAMENTE lo
    // cobrado. El impuesto se calcula con tax_rates nativos, así que tomamos el
    // total y el impuesto reales de Stripe (puede diferir por centavos del cálculo
    // local por el redondeo por línea).
    let fullSession = session;
    try {
      fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['total_details.breakdown']
      });
    } catch (e) {
      console.warn('⚠️ No se pudo expandir la sesión de Stripe, usando metadata:', e.message);
    }

    // Valores exactos de las líneas (no afectados por el redondeo de impuestos)
    const subtotal = parseFloat(session.metadata.subtotal);
    const consigne = parseFloat(session.metadata.consigne || 0);
    const shippingCost = parseFloat(session.metadata.shipping_cost);
    const freeShipping = session.metadata.free_shipping === 'true';
    const discount = parseFloat(session.metadata.discount);
    const couponCode = session.metadata.coupon_code || null;
    const couponType = session.metadata.coupon_type || null;

    // Total REAL cobrado por Stripe
    const totalAmount = typeof fullSession.amount_total === 'number'
      ? fullSession.amount_total / 100
      : parseFloat(session.metadata.total);

    // Desglose de impuestos por tasa (TPS 5% / TVQ 9.975%) calculado por Stripe
    let tps = 0;
    let tvq = 0;
    const stripeTaxes = fullSession.total_details?.breakdown?.taxes || [];
    if (stripeTaxes.length > 0) {
      for (const taxLine of stripeTaxes) {
        const pct = Number(taxLine.rate?.percentage ?? 0);
        const amount = (taxLine.amount ?? 0) / 100;
        if (pct === 5) tps += amount;
        else tvq += amount;
      }
    } else {
      // Fallback al cálculo local si Stripe no devolvió el desglose
      tps = parseFloat(session.metadata.tps);
      tvq = parseFloat(session.metadata.tvq);
    }

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

    // Crear detalles de la orden (sin variaciones)
    const cartTotals = calculateCartTotals(cartItems);
    const orderDetails = cartItems.map(item => {
      // Usar el precio ya calculado (con descuento) en cartTotals.items
      const itemData = cartTotals.items.find(i => i.productos.id === item.productos.id);
      const finalUnitPrice = itemData?.calculatedPrice || applyDiscount(item.productos.precio, item.productos.descuento);

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

    // Actualizar stock de productos (Snapshot-based update)
    console.log('📦 Actualizando stock de productos para orden:', order.id);
    for (const item of cartItems) {
      const { error: stockError } = await supabaseAdmin
        .from('productos')
        .update({
          stock: item.productos.stock - item.cantidad
        })
        .eq('id', item.productos.id);
      
      if (stockError) {
        console.error(`⚠️ Error actualizando stock para producto ${item.productos.id}:`, stockError);
      } else {
        console.log(`📉 Stock actualizado para: ${item.productos.nombre} | Nuevo stock: ${item.productos.stock - item.cantidad}`);
      }
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