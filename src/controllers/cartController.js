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
      metodoEntrega = 'puerta',
      notasEntrega = null,
      variations = [] // Array de variaciones seleccionadas: [{variationId: 1, quantity: 1}, ...]
    } = req.body;

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
          metodo_entrega: metodoEntrega,
          notas_entrega: notasEntrega
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
        variations: variations.length
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
        variations: variations.length
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

    // Get cart items WITH VARIATIONS using the optimized function
    const { cartItems } = await getCartItemsWithVariations(userId, { includePagination: false });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Cart is empty'
      });
    }

    // Calculate totals using the helper function that includes variations
    const cartTotals = calculateCartTotals(cartItems);
    
    // Calculate shipping using advanced algorithm
    const shippingResult = await calculateAdvancedShippingCostForCart(userId, cartItems);
    const shippingCost = shippingResult.cost;

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
        
        // ✨ VALIDACIÓN UUID - Cupón único por usuario
        if (coupon.usuario_asignado && coupon.usuario_asignado !== userId) {
          console.log('❌ Cupón rechazado - UUID no coincide:', {
            couponCode: coupon.codigo,
            asignadoA: coupon.usuario_asignado,
            usuarioActual: userId
          });
          return res.status(400).json({
            error: 'Cupón no válido',
            message: 'Este cupón no está asignado a tu cuenta'
          });
        }
        
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
            const totalBeforeDiscount = cartTotals.subtotal + cartTotals.totalTaxes + cartTotals.totalConsigne + shippingCost;
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
    const finalTotalBeforeDiscount = cartTotals.subtotal + cartTotals.totalTaxes + cartTotals.totalConsigne + finalShippingCost;
    const shippingThreshold = 200; // Umbral para envío gratis
    
    const total = Math.max(0, finalTotalBeforeDiscount - discountAmount);

    // Add average rating to cart items
    const cartItemsWithRating = addAverageRating(cartItems);

    res.json({
      cartItems: cartItemsWithRating,
      subtotal: cartTotals.subtotal,
      discountAmount,
      total,
      itemCount: cartItems.length,
      appliedCoupon,
      summary: {
        totalItems: cartItems.length,
        totalQuantity: cartItems.reduce((sum, item) => sum + item.cantidad, 0),
        subtotal: cartTotals.subtotal,
        subtotalWithTaxes: cartTotals.subtotal, // All items are included in subtotal now with variations
        subtotalWithConsigne: cartTotals.subtotal, // Same here  
        totalTPS: cartTotals.totalTPS,
        totalTVQ: cartTotals.totalTVQ,
        totalConsigne: cartTotals.totalConsigne,
        totalTaxes: cartTotals.totalTaxes,
        shippingCost: finalShippingCost,
        originalShippingCost: shippingResult.originalShippingCost || shippingCost,
        shippingDiscount: shippingResult.shippingDiscount || 0,
        shippingMessage: shippingResult.message,
        needsAddress: shippingResult.needsAddress,
        promotionApplied: shippingResult.promotionApplied || false,
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
