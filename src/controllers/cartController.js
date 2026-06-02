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


const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // 1. Obtener todos los items para calcular totales (Single Source of Truth)
    const { cartItems: allItems } = await getCartItemsWithVariations(userId, {
      includePagination: false
    });

    const itemCount = allItems.length;

    // 2. Calcular totales usando helper optimizado
    const cartTotals = calculateCartTotals(allItems);

    // 3. Obtener items paginados (reusando allItems)
    const offset = (page - 1) * limit;
    const paginatedItems = allItems.slice(offset, offset + limit);
    const totalPages = Math.ceil(itemCount / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: itemCount,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    // 4. Calcular costos de envío (incluyendo promociones)
    console.log('🚚 Calculating shipping for userId:', userId, 'items:', itemCount);
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, allItems);
    const shippingCost = shippingResult.cost;

    // 5. Verificar si hay cupón aplicado en el carrito (usar el primero que encontremos)
    let appliedCoupon = null;
    if (itemCount > 0 && allItems[0].cupon_codigo) {
      const couponValidation = await validateCoupon(allItems[0].cupon_codigo, userId);
      if (couponValidation.valid) {
        appliedCoupon = couponValidation.coupon;
      }
    }

    // 6. Aplicar cupón si existe
    const couponResult = applyCouponToCart(cartTotals, shippingCost, appliedCoupon);

    const shippingThreshold = 200;
    const cartItemsWithRating = addAverageRating(paginatedItems);

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
        needsAddress: shippingResult.needsAddress,
        deliverable: shippingResult.deliverable,
        shippingMessage: shippingResult.message,
        shippingThreshold,
        promotionThreshold: shippingResult.promotionThreshold,
        isPromotionEligible: shippingResult.isPromotionEligible,
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
      metodoEntrega = 'puerta',
      notasEntrega = null
    } = req.body;

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
      metodoEntrega,
      notasEntrega
    } = req.body;

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
          ecoprecio,
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
        promotionApplied: shippingResult.promotionApplied || false,
        discountAmount: couponResult.discountAmount,
        total: couponResult.total,
        itemCount: cartItems.length,
        promotionThreshold: shippingResult.promotionThreshold,
        isPromotionEligible: shippingResult.isPromotionEligible,
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

    // 1. Obtener items del carrito
    const { cartItems } = await getCartItemsWithVariations(userId, { includePagination: false });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Cart is empty'
      });
    }

    // 2. Calcular totales base
    const cartTotals = calculateCartTotals(cartItems);

    // 3. Calcular envío
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, cartItems);
    const shippingCost = shippingResult.cost;

    // 4. Validar y aplicar cupón usando helpers centralizados
    let appliedCoupon = null;
    if (couponCode) {
      const validation = await validateCoupon(couponCode, userId);
      if (validation.valid) {
        appliedCoupon = validation.coupon;
      } else if (couponCode.trim() !== '') {
        // Si se envió un código pero es inválido, devolver error
        return res.status(400).json({
          error: 'Cupón no válido',
          message: validation.error
        });
      }
    }

    const couponResult = applyCouponToCart(cartTotals, shippingCost, appliedCoupon);

    // 5. Preparar respuesta consistente
    const cartItemsWithRating = addAverageRating(cartItems);

    res.json({
      cartItems: cartItemsWithRating,
      subtotal: cartTotals.subtotal,
      discountAmount: couponResult.discountAmount,
      total: couponResult.total,
      itemCount: cartItems.length,
      appliedCoupon: couponResult.couponInfo,
      summary: {
        totalItems: cartItems.length,
        totalQuantity: cartTotals.totalQuantity,
        subtotal: cartTotals.subtotal,
        subtotalWithTaxes: cartTotals.subtotalWithTaxes,
        subtotalWithConsigne: cartTotals.subtotalWithConsigne,
        totalTPS: cartTotals.totalTPS,
        totalTVQ: cartTotals.totalTVQ,
        totalConsigne: cartTotals.totalConsigne,
        totalTaxes: cartTotals.totalTaxes,
        shippingCost: couponResult.finalShippingCost,
        originalShippingCost: shippingResult.originalShippingCost || shippingCost,
        shippingMessage: shippingResult.message,
        needsAddress: shippingResult.needsAddress,
        promotionApplied: shippingResult.promotionApplied || false,
        shippingThreshold: 200,
        totalBeforeDiscount: cartTotals.totalBeforeShipping + couponResult.finalShippingCost,
        total: couponResult.total,
        discount: couponResult.discountAmount,
        savings: couponResult.discountAmount + (couponResult.couponType === 'free_shipping' && shippingCost > 0 ? shippingCost : 0),
        freeShippingApplied: couponResult.couponType === 'free_shipping',
        promotionThreshold: shippingResult.promotionThreshold,
        isPromotionEligible: shippingResult.isPromotionEligible
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
      metodoEntrega = 'puerta',
      notasEntrega = null,
      aplicarATodos = true // Por defecto aplicar a todos los items (una sola entrega)
    } = req.body;

    // Validate delivery method
    const validMetodos = ['puerta', 'manos', 'recepcion'];
    if (!validMetodos.includes(metodoEntrega)) {
      return res.status(400).json({
        error: 'Invalid delivery method',
        message: 'Delivery method must be one of: puerta, manos, recepcion'
      });
    }

    const updateData = {
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
        .select();

      if (error) {
        throw error;
      }

      res.json({
        message: 'Default delivery options updated for items without specific settings',
        updatedItems: updatedItems.length,
        deliveryOptions: {
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
        promotionThreshold: shippingResult.promotionThreshold,
        isPromotionEligible: shippingResult.isPromotionEligible,
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
