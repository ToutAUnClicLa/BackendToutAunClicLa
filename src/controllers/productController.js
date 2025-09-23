/**
 * Product Controller
 * 
 * Handles all product-related operations including:
 * - Canadian tax fields: TPS (Goods and Services Tax), TVQ (Quebec Sales Tax), Consigne (Deposit/Handling Fee)
 * - Multiple product images: imagen_principal, imagen_secundaria, imagen_terciaria
 * - Provider/supplier information: provedor
 * - Stock management and pricing
 * - Product ratings and reviews
 */

import { supabaseAdmin } from '../config/supabase.js';

const getAllProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      subcategory,
      search, 
      sortBy = 'precio', 
      sortOrder = 'desc' 
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        precio,
        categoria_id,
        stock,
        fecha_creacion,
        imagen_principal,
        imagen_secundaria,
        imagen_terciaria,
        subcategoria_id,
        provedor,
        TPS,
        TVQ,
        consigne,
        ecoprecio,
        reviews(estrellas),
        categorias(id, nombre),
        subcategorias(id, nombre, Imagen, Descripcion, nacionalidades, codigo_postal, disponible, gmail, dias_abiertos, categoria_id)
      `, { count: 'exact' });

    // No filtrar por 'activo' ya que la columna no existe en la tabla actual

    // Filter by category
    if (category) {
      query = query.eq('categoria_id', category);
    }

    // Filter by subcategory
    if (subcategory) {
      query = query.eq('subcategoria_id', subcategory);
    }

    // Search functionality
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,descripcion.ilike.%${search}%`);
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    // Check which products have variations (for UI indicators)
    let productVariationStatus = {};
    if (products.length > 0) {
      const productIds = products.map(p => p.id);
      const { data: variationCounts } = await supabaseAdmin
        .from('variation_groups')
        .select('producto_id')
        .in('producto_id', productIds)
        .eq('active', true);
      
      if (variationCounts) {
        variationCounts.forEach(v => {
          productVariationStatus[v.producto_id] = true;
        });
      }
    }

    // Calculate average rating for each product and include all fields
    const productsWithRating = products.map(product => ({
      ...product,
      averageRating: product.reviews.length > 0 
        ? product.reviews.reduce((sum, review) => sum + review.estrellas, 0) / product.reviews.length
        : 0,
      reviewCount: product.reviews.length,
      hasVariations: productVariationStatus[product.id] || false,
      // Canadian tax fields are included: TPS (Goods and Services Tax) and TVQ (Quebec Sales Tax)
      // Additional images are included: imagen_secundaria, imagen_terciaria
      // Provider/supplier info: provedor
    }));

    res.json({
      products: productsWithRating,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      error: 'Failed to get products',
      message: error.message
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error } = await supabaseAdmin
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        precio,
        categoria_id,
        stock,
        fecha_creacion,
        imagen_principal,
        imagen_secundaria,
        imagen_terciaria,
        subcategoria_id,
        provedor,
        TPS,
        TVQ,
        consigne,
        ecoprecio,
        categorias(id, nombre),
        subcategorias(id, nombre, Imagen, Descripcion, nacionalidades, codigo_postal, disponible, gmail, dias_abiertos, categoria_id),
        reviews(
          id,
          estrellas,
          comentario,
          fecha_creacion,
          usuarios(nombre)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    // Get product variations
    const { data: variationGroups } = await supabaseAdmin
      .from('variation_groups')
      .select(`
        id,
        group_name,
        group_type,
        is_required,
        min_selections,
        max_selections,
        display_order,
        product_variations(
          id,
          name,
          description,
          price_modifier,
          stock,
          is_default,
          display_order,
          sku
        )
      `)
      .eq('producto_id', id)
      .eq('active', true)
      .order('display_order');

    // Add variations to product
    product.variations = variationGroups || [];

    // Calculate average rating and return product with all fields including new ones
    const averageRating = product.reviews.length > 0
      ? product.reviews.reduce((sum, review) => sum + review.estrellas, 0) / product.reviews.length
      : 0;

    res.json({
      ...product,
      averageRating,
      reviewCount: product.reviews.length
      // Product includes all fields: TPS, TVQ, imagen_secundaria, imagen_terciaria, provedor
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: 'Failed to get product',
      message: error.message
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      categoryId, 
      subcategoryId, 
      images, 
      stock, 
      provedor,
      tps,
      tvq,
      consigne,
      ecoprecio
    } = req.body;

    const { data: product, error } = await supabaseAdmin
      .from('productos')
      .insert([{
        nombre: name,
        descripcion: description,
        precio: price,
        categoria_id: categoryId,
        subcategoria_id: subcategoryId,
        imagen_principal: images?.[0] || null,
        imagen_secundaria: images?.[1] || null,
        imagen_terciaria: images?.[2] || null,
        stock: stock || 0,
        provedor: provedor || null,
        TPS: tps || null,
        TVQ: tvq || null,
        consigne: consigne || null,
        ecoprecio: ecoprecio || false
      }])
      .select(`
        id,
        nombre,
        descripcion,
        precio,
        categoria_id,
        stock,
        fecha_creacion,
        imagen_principal,
        imagen_secundaria,
        imagen_terciaria,
        subcategoria_id,
        provedor,
        TPS,
        TVQ,
        consigne,
        ecoprecio,
        categorias(id, nombre),
        subcategorias(id, nombre, Imagen, Descripcion, nacionalidades, codigo_postal, disponible, gmail, dias_abiertos, categoria_id)
      `)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      error: 'Failed to create product',
      message: error.message
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      price, 
      categoryId, 
      subcategoryId, 
      images, 
      stock, 
      provedor,
      tps,
      tvq,
      consigne,
      ecoprecio
    } = req.body;

    // Map frontend fields to Spanish database fields
    const updateData = {};
    if (name !== undefined) updateData.nombre = name;
    if (description !== undefined) updateData.descripcion = description;
    if (price !== undefined) updateData.precio = price;
    if (categoryId !== undefined) updateData.categoria_id = categoryId;
    if (subcategoryId !== undefined) updateData.subcategoria_id = subcategoryId;
    if (images !== undefined) {
      if (images[0] !== undefined) updateData.imagen_principal = images[0];
      if (images[1] !== undefined) updateData.imagen_secundaria = images[1];
      if (images[2] !== undefined) updateData.imagen_terciaria = images[2];
    }
    if (stock !== undefined) updateData.stock = stock;
    if (provedor !== undefined) updateData.provedor = provedor;
    if (tps !== undefined) updateData.TPS = tps;
    if (tvq !== undefined) updateData.TVQ = tvq;
    if (consigne !== undefined) updateData.consigne = consigne;
    if (ecoprecio !== undefined) updateData.ecoprecio = ecoprecio;

    const { data: product, error } = await supabaseAdmin
      .from('productos')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        nombre,
        descripcion,
        precio,
        categoria_id,
        stock,
        fecha_creacion,
        imagen_principal,
        imagen_secundaria,
        imagen_terciaria,
        subcategoria_id,
        provedor,
        TPS,
        TVQ,
        consigne,
        ecoprecio,
        categorias(id, nombre),
        subcategorias(id, nombre, Imagen, Descripcion, nacionalidades, codigo_postal, disponible, gmail, dias_abiertos, categoria_id)
      `)
      .single();

    if (error) {
      throw error;
    }

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      error: 'Failed to update product',
      message: error.message
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el producto existe antes de eliminarlo
    const { data: existingProduct, error: checkError } = await supabaseAdmin
      .from('productos')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingProduct) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    // Eliminar el producto (hard delete)
    const { error } = await supabaseAdmin
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      message: error.message
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Failed to get categories',
      message: error.message
    });
  }
};

const getSubcategories = async (req, res) => {
  try {
    const { categoryId } = req.query;

    let query = supabaseAdmin
      .from('subcategorias')
      .select(`
        *,
        categorias(id, nombre)
      `)
      .order('nombre', { ascending: true });

    // Filter by category if provided
    if (categoryId) {
      query = query.eq('categoria_id', categoryId);
    }

    const { data: subcategories, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ subcategories });
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({
      error: 'Failed to get subcategories',
      message: error.message
    });
  }
};

const getSubcategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: subcategory, error } = await supabaseAdmin
      .from('subcategorias')
      .select(`
        *,
        categorias(id, nombre)
      `)
      .eq('id', id)
      .single();

    if (error || !subcategory) {
      return res.status(404).json({
        error: 'Subcategory not found',
        message: 'The requested subcategory does not exist'
      });
    }

    // Si es un restaurante (categoria_id = 2), incluir procesamiento de dias_abiertos
    if (subcategory.categoria_id === 2) {
      const currentTime = new Date();
      const montrealTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "America/Montreal"}));
      const currentDayOfWeek = montrealTime.getDay();
      const currentHour = montrealTime.getHours();
      const currentMinute = montrealTime.getMinutes();
      const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;

      // Valores por defecto
      let diaActual = null;
      let apertura = '12:00:00';
      let cierre = '21:00:00';
      let restauranteAbiertoHoy = false;

      // Obtener horario del día actual desde dias_abiertos
      if (subcategory.dias_abiertos && Array.isArray(subcategory.dias_abiertos)) {
        diaActual = subcategory.dias_abiertos.find(dia => dia.dia === currentDayOfWeek);
        if (diaActual && diaActual.abierto) {
          restauranteAbiertoHoy = true;
          // Usar los horarios específicos del día
          apertura = diaActual.hora_apertura ?
            (diaActual.hora_apertura.split(':').length === 2 ? `${diaActual.hora_apertura}:00` : diaActual.hora_apertura)
            : '12:00:00';
          cierre = diaActual.hora_cierre ?
            (diaActual.hora_cierre.split(':').length === 2 ? `${diaActual.hora_cierre}:00` : diaActual.hora_cierre)
            : '21:00:00';
        }
      }

      // Calcular si está abierto
      let isOpen = false;
      if (restauranteAbiertoHoy && subcategory.disponible) {
        if (cierre > apertura) {
          isOpen = currentTimeString >= apertura && currentTimeString <= cierre;
        } else {
          isOpen = currentTimeString >= apertura || currentTimeString <= cierre;
        }
      }

      res.json({
        ...subcategory,
        abierto: isOpen,
        abierto_hoy: restauranteAbiertoHoy,
        dia_actual: diaActual,
        horario_actual: {
          apertura,
          cierre
        }
      });
    } else {
      res.json(subcategory);
    }
  } catch (error) {
    console.error('Get subcategory error:', error);
    res.status(500).json({
      error: 'Failed to get subcategory',
      message: error.message
    });
  }
};

const getRestaurants = async (req, res) => {
  try {
    const currentTime = new Date();
    const montrealTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "America/Montreal"}));
    const currentHour = montrealTime.getHours();
    const currentMinute = montrealTime.getMinutes();
    const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;

    const currentDayOfWeek = montrealTime.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado

    const { data: restaurants, error } = await supabaseAdmin
      .from('subcategorias')
      .select(`
        id,
        nombre,
        Imagen,
        Descripcion,
        nacionalidades,
        disponible,
        dias_abiertos,
        codigo_postal,
        gmail,
        categorias(id, nombre)
      `)
      .eq('categoria_id', 2)
      .order('nombre', { ascending: true });

    if (error) {
      throw error;
    }

    const restaurantsWithStatus = restaurants.map(restaurant => {
      // Valores por defecto
      let diaActual = null;
      let apertura = '12:00:00';
      let cierre = '21:00:00';
      let restauranteAbiertoHoy = false;

      // Obtener horario del día actual desde dias_abiertos
      if (restaurant.dias_abiertos && Array.isArray(restaurant.dias_abiertos)) {
        diaActual = restaurant.dias_abiertos.find(dia => dia.dia === currentDayOfWeek);
        if (diaActual && diaActual.abierto) {
          restauranteAbiertoHoy = true;
          // Usar los horarios específicos del día
          apertura = diaActual.hora_apertura ?
            (diaActual.hora_apertura.split(':').length === 2 ? `${diaActual.hora_apertura}:00` : diaActual.hora_apertura)
            : '12:00:00';
          cierre = diaActual.hora_cierre ?
            (diaActual.hora_cierre.split(':').length === 2 ? `${diaActual.hora_cierre}:00` : diaActual.hora_cierre)
            : '21:00:00';
        }
      }

      // Calcular la hora límite (1 hora antes del cierre)
      const cierreHour = parseInt(cierre.split(':')[0]);
      const cierreMinute = parseInt(cierre.split(':')[1]);
      const limitHour = cierreHour - 1;
      const horaLimite = `${limitHour.toString().padStart(2, '0')}:${cierreMinute.toString().padStart(2, '0')}:00`;

      let isOpen = false;
      let puedeRecibirPedidos = false;

      // Solo verificar horario si el restaurante abre hoy
      if (restauranteAbiertoHoy && restaurant.disponible) {
        // Verificar si está abierto (entre apertura y cierre)
        if (cierre > apertura) {
          isOpen = currentTimeString >= apertura && currentTimeString <= cierre;
          puedeRecibirPedidos = currentTimeString >= apertura && currentTimeString <= horaLimite;
        } else {
          // Caso cuando cierra después de medianoche
          isOpen = currentTimeString >= apertura || currentTimeString <= cierre;
          puedeRecibirPedidos = currentTimeString >= apertura || currentTimeString <= horaLimite;
        }
      }

      return {
        ...restaurant,
        abierto: isOpen,
        puede_recibir_pedidos: puedeRecibirPedidos,
        nacionalidades: restaurant.nacionalidades || [],
        dias_abiertos: restaurant.dias_abiertos || [],
        codigo_postal: restaurant.codigo_postal || null,
        gmail: restaurant.gmail || null,
        horario_entrega: {
          inicio: apertura,
          fin: cierre
        },
        hora_limite_pedidos: horaLimite,
        dia_actual: diaActual,
        abierto_hoy: restauranteAbiertoHoy
      };
    });

    res.json({
      restaurants: restaurantsWithStatus,
      currentTime: currentTimeString
    });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({
      error: 'Failed to get restaurants',
      message: error.message
    });
  }
};

export {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getSubcategories,
  getSubcategoryById,
  getRestaurants
};
