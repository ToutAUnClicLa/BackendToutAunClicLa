import stripe from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendOrderConfirmationEmail, sendPaymentFailedEmail, sendAdminOrderNotification } from '../services/emailService.js';

const createPaymentIntentFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shipping_address_id, coupon_code = null } = req.body;

    // Validate shipping address
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

    // Get cart items with product details
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

    // Validate stock availability
    for (const item of cartItems) {
      if (item.productos.stock < item.cantidad) {
        return res.status(400).json({
          error: 'Insufficient stock',
          message: `Only ${item.productos.stock} units of ${item.productos.nombre} available`
        });
      }
    }

    // Calculate totals
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

    // Apply coupon if provided
    let discount = 0;
    let couponData = null;
    if (coupon_code) {
      const { data: coupon, error: couponError } = await supabaseAdmin
        .from('cupones')
        .select('*')
        .eq('codigo', coupon_code)
        .gte('fecha_expiracion', new Date().toISOString())
        .single();

      if (!couponError && coupon) {
        discount = (subtotal * coupon.descuento) / 100;
        couponData = coupon;
      }
    }

    // Calculate shipping cost (basic calculation - can be enhanced)
    const shippingCost = calculateShippingCost(shippingAddress, subtotal);
    
    // Calculate final total
    const totalAmount = subtotal + totalTPS + totalTVQ + totalConsigne + shippingCost - discount;

    if (totalAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid total amount',
        message: 'Total amount must be greater than 0'
      });
    }

    // Get or create Stripe customer
    let stripeCustomerId = await getOrCreateStripeCustomer(userId);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: 'cad', // Canadian dollars
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        user_id: userId,
        shipping_address_id: shipping_address_id,
        coupon_code: coupon_code || '',
        subtotal: subtotal.toFixed(2),
        tps: totalTPS.toFixed(2),
        tvq: totalTVQ.toFixed(2),
        consigne: totalConsigne.toFixed(2),
        shipping_cost: shippingCost.toFixed(2),
        discount: discount.toFixed(2),
        total: totalAmount.toFixed(2)
      },
      shipping: {
        name: req.user.nombre || req.user.correo_electronico,
        address: {
          line1: shippingAddress.direccion,
          city: shippingAddress.ciudad,
          state: shippingAddress.estado,
          postal_code: shippingAddress.codigo_postal,
          country: shippingAddress.pais === 'Canada' ? 'CA' : shippingAddress.pais
        }
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderSummary: {
        items: orderItems,
        subtotal: subtotal.toFixed(2),
        tps: totalTPS.toFixed(2),
        tvq: totalTVQ.toFixed(2),
        consigne: totalConsigne.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        discount: discount.toFixed(2),
        total: totalAmount.toFixed(2),
        coupon: couponData,
        shippingAddress
      }
    });

  } catch (error) {
    console.error('Create payment intent from cart error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
};

// Helper function to calculate shipping cost
const calculateShippingCost = (address, subtotal) => {
  // Basic shipping calculation - can be enhanced with real shipping APIs
  const baseShipping = 9.99;
  const freeShippingThreshold = 200.00; // Free shipping over $200 CAD
  
  if (subtotal >= freeShippingThreshold) {
    return 0;
  }
  
  // Different rates by province (example for Canada)
  const provincialRates = {
    'Quebec': 9.99,
    'MONTREAL': 9.99, // Handle different formats
    'Ontario': 12.99,
    'British Columbia': 14.99,
    'Alberta': 13.99,
    // Add more provinces as needed
  };
  
  return provincialRates[address.estado] || baseShipping;
};

// Helper function to get or create Stripe customer
const getOrCreateStripeCustomer = async (userId) => {
  const { data: user, error } = await supabaseAdmin
    .from('usuarios')
    .select('stripe_customer_id, correo_electronico, nombre')
    .eq('id', userId)
    .single();

  if (error) throw error;

  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: user.correo_electronico,
    name: user.nombre,
    metadata: {
      user_id: userId
    }
  });

  // Update user record with Stripe customer ID
  await supabaseAdmin
    .from('usuarios')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
};

const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, currency = 'cad' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be greater than 0'
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        user_id: userId
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
};

const confirmPaymentAndCreateOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentIntentId } = req.body;

    // Get payment intent details
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not completed',
        message: 'Payment must be completed before creating order',
        status: paymentIntent.status
      });
    }

    // Verify payment intent belongs to user
    if (paymentIntent.metadata.user_id !== userId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Payment intent does not belong to current user'
      });
    }

    // Check if order already exists for this payment intent
    const { data: existingOrder } = await supabaseAdmin
      .from('pedidos')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existingOrder) {
      return res.status(400).json({
        error: 'Order already exists',
        message: 'An order has already been created for this payment'
      });
    }

    // Get current cart items (for validation)
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(id, nombre, precio, stock)
      `)
      .eq('usuario_id', userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty',
        message: 'Cannot create order from empty cart'
      });
    }

    // Validate stock again (final check)
    for (const item of cartItems) {
      if (item.productos.stock < item.cantidad) {
        return res.status(400).json({
          error: 'Insufficient stock',
          message: `Insufficient stock for ${item.productos.nombre}`
        });
      }
    }

    // Parse metadata from payment intent
    const metadata = paymentIntent.metadata;
    const totalAmount = parseFloat(metadata.total);

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        usuario_id: userId,
        total: totalAmount,
        estado: 'confirmado',
        stripe_payment_intent_id: paymentIntentId,
        direccion_envio_id: metadata.shipping_address_id || null,
        subtotal: parseFloat(metadata.subtotal),
        impuestos_tps: parseFloat(metadata.tps),
        impuestos_tvq: parseFloat(metadata.tvq),
        costos_envio: parseFloat(metadata.shipping_cost),
        descuento: parseFloat(metadata.discount),
        codigo_cupon: metadata.coupon_code || null
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Create order details
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

    // Update product stock
    for (const item of cartItems) {
      const { error: stockError } = await supabaseAdmin
        .from('productos')
        .update({ 
          stock: item.productos.stock - item.cantidad 
        })
        .eq('id', item.productos.id);

      if (stockError) {
        console.error('Stock update error:', stockError);
        // Continue with other updates even if one fails
      }
    }

    // Clear user's cart
    const { error: clearCartError } = await supabaseAdmin
      .from('carrito')
      .delete()
      .eq('usuario_id', userId);

    if (clearCartError) {
      console.error('Clear cart error:', clearCartError);
      // Don't fail the order creation if cart clearing fails
    }

    // Send order confirmation email to customer
    try {
      await sendOrderConfirmationEmail(order.id);
      console.log(`Order confirmation email sent for order ${order.id}`);
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
      // Don't fail the order creation if email fails
    }

    // Send admin notification email
    try {
      await sendAdminOrderNotification(order.id);
      console.log(`Admin notification sent for order ${order.id}`);
    } catch (adminEmailError) {
      console.error('Failed to send admin notification email:', adminEmailError);
      // Don't fail the order creation if admin email fails
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order.id,
        total: order.total,
        status: order.estado,
        created_at: order.fecha_pedido
      },
      paymentStatus: paymentIntent.status
    });

  } catch (error) {
    console.error('Confirm payment and create order error:', error);
    res.status(500).json({
      error: 'Failed to process order',
      message: error.message
    });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });

    res.json({
      status: paymentIntent.status,
      paymentIntent
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      error: 'Failed to confirm payment',
      message: error.message
    });
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's Stripe customer ID
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user || !user.stripe_customer_id) {
      return res.json({ paymentMethods: [] });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card'
    });

    res.json({
      paymentMethods: paymentMethods.data
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      error: 'Failed to get payment methods',
      message: error.message
    });
  }
};

const savePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethodId } = req.body;

    // Get or create Stripe customer
    let { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('stripe_customer_id, correo_electronico')
      .eq('id', userId)
      .single();

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.correo_electronico,
        metadata: {
          user_id: userId
        }
      });

      customerId = customer.id;

      // Update user with Stripe customer ID
      await supabaseAdmin
        .from('usuarios')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    res.json({
      message: 'Payment method saved successfully'
    });
  } catch (error) {
    console.error('Save payment method error:', error);
    res.status(500).json({
      error: 'Failed to save payment method',
      message: error.message
    });
  }
};

const deletePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({
      error: 'Failed to remove payment method',
      message: error.message
    });
  }
};

const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Log successful payment
        await supabaseAdmin
          .from('payment_logs')
          .insert({
            stripe_payment_intent_id: paymentIntent.id,
            user_id: paymentIntent.metadata.user_id,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'succeeded',
            metadata: paymentIntent.metadata
          })
          .select();
        
        // Update existing order if found
        const { data: existingOrder } = await supabaseAdmin
          .from('pedidos')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single();
          
        if (existingOrder) {
          await supabaseAdmin
            .from('pedidos')
            .update({ 
              estado: 'pagado',
              fecha_pago: new Date().toISOString()
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);
            
          // Send order confirmation email if not already sent
          try {
            const { data: orderCheck } = await supabaseAdmin
              .from('pedidos')
              .select('email_confirmacion_enviado')
              .eq('id', existingOrder.id)
              .single();
              
            if (!orderCheck?.email_confirmacion_enviado) {
              await sendOrderConfirmationEmail(existingOrder.id);
              console.log(`Order confirmation email sent for order ${existingOrder.id} via webhook`);
            }
          } catch (emailError) {
            console.error('Failed to send order confirmation email via webhook:', emailError);
          }
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id, failedPayment.last_payment_error);
        
        // Log failed payment
        await supabaseAdmin
          .from('payment_logs')
          .insert({
            stripe_payment_intent_id: failedPayment.id,
            user_id: failedPayment.metadata.user_id,
            amount: failedPayment.amount / 100,
            currency: failedPayment.currency,
            status: 'failed',
            error_message: failedPayment.last_payment_error?.message,
            metadata: failedPayment.metadata
          })
          .select();
        
        // Update order status if exists
        await supabaseAdmin
          .from('pedidos')
          .update({ 
            estado: 'pago_fallido',
            notas: failedPayment.last_payment_error?.message
          })
          .eq('stripe_payment_intent_id', failedPayment.id);
          
        // Send payment failed email
        try {
          if (failedPayment.metadata.user_id) {
            await sendPaymentFailedEmail(
              failedPayment.metadata.user_id,
              failedPayment.id,
              failedPayment.last_payment_error?.message || 'Unknown error'
            );
          }
        } catch (emailError) {
          console.error('Failed to send payment failed email:', emailError);
        }
        break;

      case 'payment_intent.requires_action':
        const actionRequired = event.data.object;
        console.log('Payment requires action:', actionRequired.id);
        
        await supabaseAdmin
          .from('pedidos')
          .update({ estado: 'accion_requerida' })
          .eq('stripe_payment_intent_id', actionRequired.id);
        break;

      case 'payment_intent.canceled':
        const canceledPayment = event.data.object;
        console.log('Payment canceled:', canceledPayment.id);
        
        await supabaseAdmin
          .from('pedidos')
          .update({ estado: 'cancelado' })
          .eq('stripe_payment_intent_id', canceledPayment.id);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Handle subscription events if you implement subscriptions later
        console.log(`Subscription event: ${event.type}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({
      error: 'Webhook handler failed',
      message: error.message
    });
  }
};

// Get payment intent status
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify payment intent belongs to user
    if (paymentIntent.metadata.user_id !== userId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Payment intent does not belong to current user'
      });
    }

    res.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      error: 'Failed to get payment status',
      message: error.message
    });
  }
};

// Refund payment
const createRefund = async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;
    const userId = req.user.id;

    // Get payment intent to verify ownership and status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata.user_id !== userId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Payment intent does not belong to current user'
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Cannot refund',
        message: 'Only successful payments can be refunded'
      });
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
      reason: reason
    });

    // Update order status
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
    console.error('Create refund error:', error);
    res.status(500).json({
      error: 'Failed to create refund',
      message: error.message
    });
  }
};

export {
  createPaymentIntentFromCart,
  createPaymentIntent,
  confirmPaymentAndCreateOrder,
  confirmPayment,
  getPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  handleWebhook,
  getPaymentStatus,
  createRefund
};
