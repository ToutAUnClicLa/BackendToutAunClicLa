import { supabaseAdmin } from '../config/supabase.js';

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
    const limit = parseInt(req.query.limit) || 20; // Default 20 items per page
    const offset = (page - 1) * limit;

    // Get total count first
    const { count, error: countError } = await supabaseAdmin
      .from('carrito')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId);

    if (countError) {
      throw countError;
    }

    // Get paginated cart items
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
      .eq('usuario_id', userId)
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Calculate total for all items (not just current page)
    const { data: allItems, error: allItemsError } = await supabaseAdmin
      .from('carrito')
      .select(`
        cantidad,
        productos(precio, TPS, TVQ, consigne)
      `)
      .eq('usuario_id', userId);

    if (allItemsError) {
      throw allItemsError;
    }

    const subtotal = allItems.reduce((sum, item) => {
      return sum + (item.productos.precio * item.cantidad);
    }, 0);

    // Calculate total TPS and TVQ for all items in cart
    const totalTPS = allItems.reduce((sum, item) => {
      const itemTPS = item.productos.TPS || 0;
      const tpsAmount = itemTPS > 0 ? (item.productos.precio * itemTPS / 100) * item.cantidad : 0;
      return sum + tpsAmount;
    }, 0);

    const totalTVQ = allItems.reduce((sum, item) => {
      const itemTVQ = item.productos.TVQ || 0;
      const tvqAmount = itemTVQ > 0 ? (item.productos.precio * itemTVQ / 100) * item.cantidad : 0;
      return sum + tvqAmount;
    }, 0);

    const totalConsigne = allItems.reduce((sum, item) => {
      const itemConsigne = item.productos.consigne || 0;
      return sum + (itemConsigne * item.cantidad);
    }, 0);

    // Calculate totals for products with different tax types
    const subtotalWithTaxes = allItems.reduce((sum, item) => {
      const hasTaxes = (item.productos.TPS && item.productos.TPS > 0) || 
                      (item.productos.TVQ && item.productos.TVQ > 0);
      if (hasTaxes) {
        return sum + (item.productos.precio * item.cantidad);
      }
      return sum;
    }, 0);

    const subtotalWithConsigne = allItems.reduce((sum, item) => {
      const hasConsigne = item.productos.consigne && item.productos.consigne > 0;
      if (hasConsigne) {
        return sum + (item.productos.precio * item.cantidad);
      }
      return sum;
    }, 0);

    // Calculate shipping (free shipping over $200 CAD)
    const shippingThreshold = 200;
    const shippingCost = subtotal >= shippingThreshold ? 0 : 8.99;

    const totalTaxes = totalTPS + totalTVQ + totalConsigne;
    const total = subtotal + totalTaxes + shippingCost;

    const totalPages = Math.ceil(count / limit);

    // Add average rating to cart items
    const cartItemsWithRating = addAverageRating(cartItems);

    res.json({
      cartItems: cartItemsWithRating,
      total,
      itemCount: count,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      summary: {
        totalItems: count,
        totalQuantity: allItems.reduce((sum, item) => sum + item.cantidad, 0),
        subtotal: subtotal,
        subtotalWithTaxes: subtotalWithTaxes,
        subtotalWithConsigne: subtotalWithConsigne,
        totalTPS: totalTPS,
        totalTVQ: totalTVQ,
        totalConsigne: totalConsigne,
        totalTaxes: totalTaxes,
        shippingCost: shippingCost,
        shippingThreshold: shippingThreshold,
        total: total
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
      horaEntregaPreferida = '18:00', // Por defecto 6:00 PM
      metodoEntrega = 'puerta',
      notasEntrega = null
    } = req.body;

    // Validate delivery hour (12:00 PM to 22:00 PM)
    if (horaEntregaPreferida) {
      const hora = horaEntregaPreferida.split(':');
      const horaNum = parseInt(hora[0]);
      const minutoNum = parseInt(hora[1]);
      
      if (horaNum < 12 || horaNum > 21 || minutoNum < 0 || minutoNum > 59) {
        return res.status(400).json({
          error: 'Invalid delivery time',
          message: 'Delivery time must be between 12:00 PM and 9:00 PM'
        });
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
          notas_entrega: notasEntrega
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({
        message: 'Cart updated successfully',
        cartItem: updatedItem
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
          notas_entrega: notasEntrega
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({
        message: 'Item added to cart successfully',
        cartItem
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
      notasEntrega
    } = req.body;

    // Validate delivery hour if provided (12:00 PM to 22:00 PM)
    if (horaEntregaPreferida) {
      const hora = horaEntregaPreferida.split(':');
      const horaNum = parseInt(hora[0]);
      const minutoNum = parseInt(hora[1]);
      
      if (horaNum < 12 || horaNum > 21 || minutoNum < 0 || minutoNum > 59) {
        return res.status(400).json({
          error: 'Invalid delivery time',
          message: 'Delivery time must be between 12:00 PM and 9:00 PM'
        });
      }
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
    if (horaEntregaPreferida !== undefined) updateData.hora_entrega_preferida = horaEntregaPreferida;
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

    res.json({
      message: 'Cart item updated successfully',
      cartItem: updatedItem
    });
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

    // Validate coupon exists and is not expired
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('cupones')
      .select('*')
      .eq('codigo', couponCode.toUpperCase())
      .single();

    if (couponError || !coupon) {
      return res.status(404).json({
        error: 'Invalid coupon',
        message: 'Coupon code not found or invalid'
      });
    }

    // Check if coupon is expired
    if (coupon.fecha_expiracion && new Date(coupon.fecha_expiracion) < new Date()) {
      return res.status(400).json({
        error: 'Coupon expired',
        message: 'This coupon has expired'
      });
    }

    // Get current cart
    const { data: cartItems, error: cartError } = await supabaseAdmin
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
      .eq('usuario_id', userId);

    if (cartError) {
      throw cartError;
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Cannot apply coupon to empty cart'
      });
    }

    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.productos.precio * item.cantidad);
    }, 0);

    // Calculate discount
    const discountAmount = (subtotal * coupon.descuento) / 100;
    const total = Math.max(0, subtotal - discountAmount);

    res.json({
      message: 'Coupon applied successfully',
      coupon: {
        id: coupon.id,
        code: coupon.codigo,
        discount: coupon.descuento
      },
      cartSummary: {
        subtotal,
        discountAmount,
        total,
        itemCount: cartItems.length
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
    const { couponCode } = req.body;

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

    // Calculate shipping (free shipping over $200 CAD)
    const shippingThreshold = 200;
    const shippingCost = subtotal >= shippingThreshold ? 0 : 8.99;

    const totalTaxes = totalTPS + totalTVQ + totalConsigne;

    let discountAmount = 0;
    let appliedCoupon = null;

    // Apply coupon if provided
    if (couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from('cupones')
        .select('*')
        .eq('codigo', couponCode.toUpperCase())
        .single();

      if (coupon && (!coupon.fecha_expiracion || new Date(coupon.fecha_expiracion) >= new Date())) {
        discountAmount = (subtotal * coupon.descuento) / 100;
        appliedCoupon = {
          id: coupon.id,
          code: coupon.codigo,
          discount: coupon.descuento
        };
      }
    }

    const total = Math.max(0, subtotal + totalTaxes + shippingCost - discountAmount);

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
        shippingCost: shippingCost,
        shippingThreshold: shippingThreshold,
        total,
        discount: discountAmount,
        savings: discountAmount
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
      horaEntregaPreferida = '18:00', // Por defecto 6:00 PM
      metodoEntrega = 'puerta',
      notasEntrega = null,
      aplicarATodos = true // Por defecto aplicar a todos los items (una sola entrega)
    } = req.body;

    // Validate delivery hour (12:00 PM to 22:00 PM)
    if (horaEntregaPreferida) {
      const hora = horaEntregaPreferida.split(':');
      const horaNum = parseInt(hora[0]);
      const minutoNum = parseInt(hora[1]);
      
      if (horaNum < 12 || horaNum > 21 || minutoNum < 0 || minutoNum > 59) {
        return res.status(400).json({
          error: 'Invalid delivery time',
          message: 'Delivery time must be between 12:00 PM and 9:00 PM'
        });
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

    const updateData = {
      hora_entrega_preferida: horaEntregaPreferida,
      metodo_entrega: metodoEntrega,
      notas_entrega: notasEntrega
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
          notasEntrega
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
          notasEntrega
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

export {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  getCartWithCoupon,
  updateDeliveryOptions
};
