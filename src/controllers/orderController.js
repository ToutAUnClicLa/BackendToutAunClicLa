import { supabaseAdmin } from '../config/supabase.js';
import stripe from '../config/stripe.js';

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        total,
        estado,
        fecha_pedido,
        fecha_pago,
        subtotal,
        impuestos_tps,
        impuestos_tvq,
        costos_envio,
        descuento,
        codigo_cupon,
        notas,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        detalles_pedido(
          id,
          cantidad,
          precio_unitario,
          productos(
            id,
            nombre,
            imagen_principal,
            categoria_id,
            categorias(nombre)
          )
        ),
        direcciones_envio(
          id,
          direccion,
          ciudad,
          estado,
          codigo_postal,
          pais
        )
      `, { count: 'exact' })
      .eq('usuario_id', userId);

    if (status) {
      const validStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado', 'pagado'];
      if (validStatuses.includes(status)) {
        query = query.eq('estado', status);
      }
    }

    query = query
      .order('fecha_pedido', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform data for frontend usage
    const transformedOrders = orders.map(order => {
      const totalItems = order.detalles_pedido?.reduce((sum, item) => sum + item.cantidad, 0) || 0;
      
      return {
        // Basic order info
        id: order.id,
        orderNumber: `ORD-${String(order.id).padStart(6, '0')}`,
        status: order.estado,
        total: parseFloat(order.total),
        orderDate: order.fecha_pedido,
        paymentDate: order.fecha_pago,
        
        // Financial breakdown
        pricing: {
          subtotal: parseFloat(order.subtotal || 0),
          taxes: {
            tps: parseFloat(order.impuestos_tps || 0),
            tvq: parseFloat(order.impuestos_tvq || 0),
            total: parseFloat(order.impuestos_tps || 0) + parseFloat(order.impuestos_tvq || 0)
          },
          shipping: parseFloat(order.costos_envio || 0),
          discount: parseFloat(order.descuento || 0),
          couponCode: order.codigo_cupon,
          finalTotal: parseFloat(order.total)
        },
        
        // Order summary
        summary: {
          totalItems,
          productCount: order.detalles_pedido?.length || 0
        },
        
        // Shipping information
        shipping: order.direcciones_envio ? {
          address: order.direcciones_envio.direccion,
          city: order.direcciones_envio.ciudad,
          state: order.direcciones_envio.estado,
          postalCode: order.direcciones_envio.codigo_postal,
          country: order.direcciones_envio.pais,
          fullAddress: `${order.direcciones_envio.direccion}, ${order.direcciones_envio.ciudad}, ${order.direcciones_envio.estado} ${order.direcciones_envio.codigo_postal}, ${order.direcciones_envio.pais}`
        } : null,
        
        // Order items preview (first 3 items for list display)
        itemsPreview: order.detalles_pedido?.slice(0, 3).map(item => ({
          id: item.id,
          productId: item.productos?.id,
          name: item.productos?.nombre,
          image: item.productos?.imagen_principal,
          category: item.productos?.categorias?.nombre,
          quantity: item.cantidad,
          unitPrice: parseFloat(item.precio_unitario),
          totalPrice: parseFloat(item.precio_unitario) * item.cantidad
        })) || [],
        
        // Additional metadata
        notes: order.notas,
        paymentInfo: {
          stripeSessionId: order.stripe_checkout_session_id,
          stripePaymentIntentId: order.stripe_payment_intent_id
        }
      };
    });

    res.json({
      success: true,
      data: {
        orders: transformedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(count / limit),
          hasPreviousPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve orders',
      message: error.message
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate order ID format
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID',
        message: 'Order ID must be a valid number'
      });
    }

    const { data: order, error } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        total,
        estado,
        fecha_pedido,
        fecha_pago,
        subtotal,
        impuestos_tps,
        impuestos_tvq,
        costos_envio,
        descuento,
        codigo_cupon,
        notas,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        fecha_reembolso,
        monto_reembolso,
        email_confirmacion_enviado,
        fecha_email_enviado,
        detalles_pedido(
          id,
          cantidad,
          precio_unitario,
          productos(
            id,
            nombre,
            descripcion,
            imagen_principal,
            imagen_secundaria,
            imagen_terciaria,
            categoria_id,
            categorias(nombre),
            subcategoria_id,
            subcategorias(nombre)
          )
        ),
        direcciones_envio(
          id,
          direccion,
          ciudad,
          estado,
          codigo_postal,
          pais
        )
      `)
      .eq('id', id)
      .eq('usuario_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        message: 'The requested order does not exist or you do not have permission to view it'
      });
    }

    if (error) {
      throw error;
    }

    // Transform detailed order data for frontend
    const transformedOrder = {
      // Basic order information
      id: order.id,
      orderNumber: `ORD-${String(order.id).padStart(6, '0')}`,
      status: order.estado,
      orderDate: order.fecha_pedido,
      paymentDate: order.fecha_pago,
      
      // Financial breakdown
      pricing: {
        subtotal: parseFloat(order.subtotal || 0),
        taxes: {
          tps: parseFloat(order.impuestos_tps || 0),
          tvq: parseFloat(order.impuestos_tvq || 0),
          total: parseFloat(order.impuestos_tps || 0) + parseFloat(order.impuestos_tvq || 0)
        },
        shipping: parseFloat(order.costos_envio || 0),
        discount: parseFloat(order.descuento || 0),
        couponCode: order.codigo_cupon,
        finalTotal: parseFloat(order.total)
      },
      
      // Refund information
      refund: {
        date: order.fecha_reembolso,
        amount: parseFloat(order.monto_reembolso || 0),
        isRefunded: !!order.fecha_reembolso
      },
      
      // Shipping information
      shipping: order.direcciones_envio ? {
        address: order.direcciones_envio.direccion,
        city: order.direcciones_envio.ciudad,
        state: order.direcciones_envio.estado,
        postalCode: order.direcciones_envio.codigo_postal,
        country: order.direcciones_envio.pais,
        fullAddress: `${order.direcciones_envio.direccion}, ${order.direcciones_envio.ciudad}, ${order.direcciones_envio.estado} ${order.direcciones_envio.codigo_postal}, ${order.direcciones_envio.pais}`
      } : null,
      
      // Complete order items
      items: order.detalles_pedido?.map(item => ({
        id: item.id,
        productId: item.productos?.id,
        name: item.productos?.nombre,
        description: item.productos?.descripcion,
        images: {
          primary: item.productos?.imagen_principal,
          secondary: item.productos?.imagen_secundaria,
          tertiary: item.productos?.imagen_terciaria
        },
        category: {
          id: item.productos?.categoria_id,
          name: item.productos?.categorias?.nombre
        },
        subcategory: {
          id: item.productos?.subcategoria_id,
          name: item.productos?.subcategorias?.nombre
        },
        quantity: item.cantidad,
        unitPrice: parseFloat(item.precio_unitario),
        totalPrice: parseFloat(item.precio_unitario) * item.cantidad
      })) || [],
      
      // Order summary
      summary: {
        totalItems: order.detalles_pedido?.reduce((sum, item) => sum + item.cantidad, 0) || 0,
        productCount: order.detalles_pedido?.length || 0,
        orderValue: parseFloat(order.total)
      },
      
      // Additional information
      notes: order.notas,
      communication: {
        emailConfirmationSent: order.email_confirmacion_enviado,
        emailSentDate: order.fecha_email_enviado
      },
      paymentInfo: {
        stripeSessionId: order.stripe_checkout_session_id,
        stripePaymentIntentId: order.stripe_payment_intent_id
      }
    };

    res.json({
      success: true,
      data: {
        order: transformedOrder
      }
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve order',
      message: error.message
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId, paymentMethodId } = req.body;

    // Get cart items
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('carrito')
      .select(`
        *,
        productos(id, nombre, precio, stock)
      `)
      .eq('usuario_id', userId);

    if (cartError) {
      throw cartError;
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Your cart is empty'
      });
    }

    // Validate stock and calculate total
    let total = 0;
    const orderItems = [];

    for (const item of cartItems) {
      const product = item.productos;
      
      // No hay campo 'activo', así que eliminamos esa validación

      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: 'Insufficient stock',
          message: `Only ${product.stock} units of ${product.nombre} available`
        });
      }

      const itemTotal = product.precio * item.quantity;
      total += itemTotal;

      orderItems.push({
        producto_id: product.id,
        quantity: item.quantity,
        price: product.precio
      });
    }

    // Verify address belongs to user
    const { data: address, error: addressError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('*')
      .eq('id', addressId)
      .eq('usuario_id', userId)
      .single();

    if (addressError || !address) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'The selected address does not exist'
      });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/order-confirmation`
    });

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment failed',
        message: 'Payment could not be processed'
      });
    }

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .insert([{
        usuario_id: userId,
        direccion_envio_id: addressId,
        total: total,
        estado: 'pendiente',
        stripe_payment_intent_id: paymentIntent.id
      }])
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Create order items
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      pedido_id: order.id
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('detalles_pedido')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      throw itemsError;
    }

    // Update product stock
    for (const item of cartItems) {
      await supabaseAdmin
        .from('productos')
        .update({ 
          stock: item.productos.stock - item.quantity 
        })
        .eq('id', item.productos.id);
    }

    // Clear cart
    await supabaseAdmin
      .from('carrito')
      .delete()
      .eq('usuario_id', userId);

    // Update order status to completed
    await supabaseAdmin
      .from('pedidos')
      .update({ estado: 'completado' })
      .eq('id', order.id);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        ...order,
        estado: 'completado'
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      error: 'Failed to create order',
      message: error.message
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .eq('usuario_id', userId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'The requested order does not exist'
      });
    }

    if (order.estado !== 'pendiente') {
      return res.status(400).json({
        error: 'Cannot cancel order',
        message: 'Only pending orders can be cancelled'
      });
    }

    // Cancel Stripe payment intent if exists
    if (order.stripe_payment_intent_id) {
      await stripe.paymentIntents.cancel(order.stripe_payment_intent_id);
    }

    // Update order status
    const { error } = await supabaseAdmin
      .from('pedidos')
      .update({ estado: 'cancelado' })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      error: 'Failed to cancel order',
      message: error.message
    });
  }
};

// Admin functions
const getAllOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      sortBy = 'fecha_pedido', 
      sortOrder = 'desc' 
    } = req.query;

    const offset = (page - 1) * limit;
    const validSortFields = ['fecha_pedido', 'total', 'estado', 'id'];
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'fecha_pedido';

    let query = supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        usuario_id,
        total,
        estado,
        fecha_pedido,
        fecha_pago,
        subtotal,
        impuestos_tps,
        impuestos_tvq,
        costos_envio,
        descuento,
        codigo_cupon,
        notas,
        stripe_checkout_session_id,
        usuarios(
          id,
          nombre,
          correo_electronico,
          telefono
        ),
        detalles_pedido(
          id,
          cantidad,
          precio_unitario,
          productos(
            id,
            nombre,
            imagen_principal
          )
        ),
        direcciones_envio(
          id,
          direccion,
          ciudad,
          estado,
          codigo_postal,
          pais
        )
      `, { count: 'exact' });

    if (status) {
      const validStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado', 'pagado'];
      if (validStatuses.includes(status)) {
        query = query.eq('estado', status);
      }
    }

    query = query
      .order(actualSortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform data for admin frontend
    const transformedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: `ORD-${String(order.id).padStart(6, '0')}`,
      customer: {
        id: order.usuarios?.id,
        name: order.usuarios?.nombre,
        email: order.usuarios?.correo_electronico,
        phone: order.usuarios?.telefono
      },
      status: order.estado,
      total: parseFloat(order.total),
      orderDate: order.fecha_pedido,
      paymentDate: order.fecha_pago,
      itemCount: order.detalles_pedido?.length || 0,
      totalItems: order.detalles_pedido?.reduce((sum, item) => sum + item.cantidad, 0) || 0,
      shipping: order.direcciones_envio ? {
        city: order.direcciones_envio.ciudad,
        state: order.direcciones_envio.estado,
        country: order.direcciones_envio.pais
      } : null,
      paymentInfo: {
        stripeSessionId: order.stripe_checkout_session_id
      }
    }));

    res.json({
      success: true,
      data: {
        orders: transformedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(count / limit),
          hasPreviousPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve orders',
      message: error.message
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate order ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID',
        message: 'Order ID must be a valid number'
      });
    }

    const validStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado', 'pagado'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: 'Status must be one of: ' + validStatuses.join(', ')
      });
    }

    // First check if order exists
    const { data: existingOrder, error: checkError } = await supabaseAdmin
      .from('pedidos')
      .select('id, estado')
      .eq('id', id)
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        message: 'The requested order does not exist'
      });
    }

    if (checkError) {
      throw checkError;
    }

    // Update the order status
    const { data: order, error } = await supabaseAdmin
      .from('pedidos')
      .update({ estado: status })
      .eq('id', id)
      .select(`
        id,
        estado,
        total,
        fecha_pedido,
        usuario_id,
        usuarios(nombre, correo_electronico)
      `)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: {
          id: order.id,
          orderNumber: `ORD-${String(order.id).padStart(6, '0')}`,
          status: order.estado,
          previousStatus: existingOrder.estado,
          total: parseFloat(order.total),
          orderDate: order.fecha_pedido,
          customer: {
            id: order.usuario_id,
            name: order.usuarios?.nombre,
            email: order.usuarios?.correo_electronico
          }
        }
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      message: error.message
    });
  }
};

// Get user order statistics for dashboard
const getUserOrderStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get order statistics
    const { data: orders, error } = await supabaseAdmin
      .from('pedidos')
      .select('id, estado, total, fecha_pedido')
      .eq('usuario_id', userId);

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0),
      ordersByStatus: orders.reduce((acc, order) => {
        acc[order.estado] = (acc[order.estado] || 0) + 1;
        return acc;
      }, {}),
      recentOrdersCount: orders.filter(order => {
        const orderDate = new Date(order.fecha_pedido);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return orderDate >= thirtyDaysAgo;
      }).length,
      averageOrderValue: orders.length > 0 ? 
        orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0) / orders.length : 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user order stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve order statistics',
      message: error.message
    });
  }
};

export {
  getUserOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getUserOrderStats
};
