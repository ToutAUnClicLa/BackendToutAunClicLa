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
      return sum + (itemTPS * item.cantidad);
    }, 0);

    const totalTVQ = allItems.reduce((sum, item) => {
      const itemTVQ = item.productos.TVQ || 0;
      return sum + (itemTVQ * item.cantidad);
    }, 0);

    const totalConsigne = allItems.reduce((sum, item) => {
      const itemConsigne = item.productos.consigne || 0;
      return sum + (itemConsigne * item.cantidad);
    }, 0);

    const totalTaxes = totalTPS + totalTVQ + totalConsigne;
    const total = subtotal + totalTaxes;

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
        totalTPS: totalTPS,
        totalTVQ: totalTVQ,
        totalConsigne: totalConsigne,
        totalTaxes: totalTaxes,
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
    const { productId, quantity } = req.body;

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
        .update({ cantidad: newQuantity })
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
          cantidad: quantity
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
    const { quantity } = req.body;

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

    const { data: updatedItem, error } = await supabaseAdmin
      .from('carrito')
      .update({ cantidad: quantity })
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
      return sum + (itemTPS * item.cantidad);
    }, 0);

    const totalTVQ = cartItems.reduce((sum, item) => {
      const itemTVQ = item.productos.TVQ || 0;
      return sum + (itemTVQ * item.cantidad);
    }, 0);

    const totalConsigne = cartItems.reduce((sum, item) => {
      const itemConsigne = item.productos.consigne || 0;
      return sum + (itemConsigne * item.cantidad);
    }, 0);

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

    const total = Math.max(0, subtotal + totalTaxes - discountAmount);

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
        totalTPS: totalTPS,
        totalTVQ: totalTVQ,
        totalTaxes: totalTaxes,
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

export {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  getCartWithCoupon
};
