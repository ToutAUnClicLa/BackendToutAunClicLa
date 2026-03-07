import { supabaseAdmin } from '../config/supabase.js';

// === PERFIL ===
export const getProfile = async (req, res) => {
    try {
        const { restauranteId } = req;

        const { data: profile, error } = await supabaseAdmin
            .from('subcategorias')
            .select('*')
            .eq('id', restauranteId)
            .single();

        if (error) throw error;

        res.json({ profile });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile', message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { nombre, Descripcion, Imagen, dias_abiertos, disponible } = req.body;

        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (Descripcion !== undefined) updateData.Descripcion = Descripcion;
        if (Imagen !== undefined) updateData.Imagen = Imagen;
        if (dias_abiertos !== undefined) updateData.dias_abiertos = dias_abiertos;
        if (disponible !== undefined) updateData.disponible = disponible;

        const { data: profile, error } = await supabaseAdmin
            .from('subcategorias')
            .update(updateData)
            .eq('id', restauranteId)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Profile updated', profile });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile', message: error.message });
    }
};

export const deleteOwnRestaurant = async (req, res) => {
    try {
        const { restauranteId } = req;

        // Primero intentar borrar productos y usuarios manualmente por precaución
        await supabaseAdmin.from('productos').delete().eq('subcategoria_id', restauranteId);
        await supabaseAdmin.from('restaurantes_usuarios').delete().eq('restaurante_id', restauranteId);

        const { error } = await supabaseAdmin
            .from('subcategorias')
            .delete()
            .eq('id', restauranteId);

        if (error) throw error;

        res.json({ message: 'Tu cuenta y restaurante han sido eliminados correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete restaurant', message: error.message });
    }
};

// === PRODUCTOS ===
export const getProducts = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { page = 1, limit = 10, search = '' } = req.query;

        let query = supabaseAdmin
            .from('productos')
            .select('*', { count: 'exact' })
            .eq('subcategoria_id', restauranteId);

        if (search && search.trim() !== '') {
            query = query.or(`nombre.ilike.%${search}%,descripcion.ilike.%${search}%`);
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const { data: products, count, error } = await query
            .order('fecha_creacion', { ascending: false })
            .range(from, to);

        if (error) throw error;

        res.json({
            products,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            currentPage: pageNum
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products', message: error.message });
    }
};

export const getProduct = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { id } = req.params;

        const { data: product, error } = await supabaseAdmin
            .from('productos')
            .select('*')
            .eq('id', id)
            .eq('subcategoria_id', restauranteId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: 'Product not found' });
            throw error;
        }

        res.json({ product });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product', message: error.message });
    }
};

export const createProduct = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { nombre, descripcion, precio, stock, imagen_principal, dias_disponibles } = req.body;

        const { data: product, error } = await supabaseAdmin
            .from('productos')
            .insert([{
                subcategoria_id: restauranteId,
                categoria_id: 2, // 2 is Comidas/Restaurants
                nombre,
                descripcion,
                precio,
                stock: stock || 0,
                imagen_principal,
                dias_disponibles: dias_disponibles || [0, 1, 2, 3, 4, 5, 6]
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create product', message: error.message });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { id } = req.params;
        const { nombre, descripcion, precio, stock, imagen_principal, dias_disponibles } = req.body;

        // Ensure product belongs to this restaurant
        const { data: existing, error: checkErr } = await supabaseAdmin
            .from('productos')
            .select('id')
            .eq('id', id)
            .eq('subcategoria_id', restauranteId)
            .single();

        if (checkErr || !existing) return res.status(403).json({ error: 'No permissions' });

        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (precio !== undefined) updateData.precio = precio;
        if (stock !== undefined) updateData.stock = stock;
        if (imagen_principal !== undefined) updateData.imagen_principal = imagen_principal;
        if (dias_disponibles !== undefined) updateData.dias_disponibles = dias_disponibles;

        const { data: product, error } = await supabaseAdmin
            .from('productos')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Product updated', product });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update product', message: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('productos')
            .delete()
            .eq('id', id)
            .eq('subcategoria_id', restauranteId);

        if (error) throw error;

        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product', message: error.message });
    }
};

// === PEDIDOS ===
export const getOrders = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { page = 1, limit = 10, search = '' } = req.query;

        // 1. Get unique order IDs for this restaurant
        const { data: itemsIds, error: itemsErr } = await supabaseAdmin
            .from('detalles_pedido')
            .select('pedido_id, productos!inner(subcategoria_id)')
            .eq('productos.subcategoria_id', restauranteId);

        if (itemsErr) throw itemsErr;

        if (!itemsIds || itemsIds.length === 0) {
            return res.json({ orders: [], total: 0, totalPages: 0, currentPage: Number(page) });
        }

        const orderIds = [...new Set(itemsIds.map(item => item.pedido_id))];

        let query = supabaseAdmin
            .from('pedidos')
            .select(`
                id, estado, fecha_pedido, total, notas,
                usuarios!inner(nombre, correo_electronico, telefono),
                direcciones_envio(direccion, ciudad, estado, codigo_postal)
            `, { count: 'exact' })
            .in('id', orderIds);

        if (search) {
            const searchNum = parseInt(search);
            if (!isNaN(searchNum) && search.trim() !== '') {
                query = query.eq('id', searchNum);
            } else {
                query = query.or(`nombre.ilike.%${search}%,correo_electronico.ilike.%${search}%`, { foreignTable: 'usuarios' });
            }
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        // 2. Fetch pedidios with search and pagination
        const { data: ordersData, count, error: ordersErr } = await query
            .order('fecha_pedido', { ascending: false })
            .range(from, to);

        if (ordersErr) throw ordersErr;

        const finalOrderIds = ordersData.map(o => o.id);

        // Fetch items only for the paginated orders
        const { data: finalItems, error: finalItemsErr } = await supabaseAdmin
            .from('detalles_pedido')
            .select('pedido_id, cantidad, precio_unitario, productos!inner(id, nombre, imagen_principal, subcategoria_id)')
            .eq('productos.subcategoria_id', restauranteId)
            .in('pedido_id', finalOrderIds);

        if (finalItemsErr) throw finalItemsErr;

        // 3. Assemble response associating only the items from this restaurant
        const orders = ordersData.map(order => {
            const itemsForThisOrder = finalItems.filter(item => item.pedido_id === order.id);
            const restaurantTotal = itemsForThisOrder.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);

            return {
                ...order,
                restaurant_total: restaurantTotal,
                items: itemsForThisOrder.map(item => ({
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    producto: item.productos
                }))
            };
        });

        res.json({
            orders,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            currentPage: pageNum
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders', message: error.message });
    }
};

// === ESTADÍSTICAS ===
export const getStats = async (req, res) => {
    try {
        const { restauranteId } = req;
        const { period = 'week' } = req.query;

        // Fetch order items with their corresponding order status and date
        const { data: orderItems, error: itemsErr } = await supabaseAdmin
            .from('detalles_pedido')
            .select('pedido_id, cantidad, precio_unitario, productos!inner(id, subcategoria_id), pedidos!inner(estado, fecha_pedido)')
            .eq('productos.subcategoria_id', restauranteId);

        if (itemsErr) throw itemsErr;

        let totalSales = 0;
        let totalOrders = new Set();
        let pendingOrders = new Set();
        let dailySalesMap = {};

        // Figure out date threshold for filtering
        const today = new Date();
        const pastDate = new Date();
        if (period === 'week') {
            pastDate.setDate(today.getDate() - 7);
        } else if (period === 'month') {
            pastDate.setDate(today.getDate() - 30);
        } else if (period === 'year') {
            pastDate.setFullYear(today.getFullYear() - 1);
        } else {
            // all time
            pastDate.setFullYear(2000);
        }

        orderItems.forEach(item => {
            const itemDate = new Date(item.pedidos.fecha_pedido);

            // Only aggregate orders within the selected period
            if (itemDate >= pastDate) {
                const dateKey = itemDate.toISOString().split('T')[0]; // YYYY-MM-DD
                const amount = item.cantidad * item.precio_unitario;

                // Consider only orders that are not cancelled for revenue
                if (item.pedidos.estado !== 'cancelado') {
                    totalSales += amount;

                    if (!dailySalesMap[dateKey]) {
                        dailySalesMap[dateKey] = { date: dateKey, total: 0, orders: 0 };
                    }
                    dailySalesMap[dateKey].total += amount;
                }

                totalOrders.add(item.pedido_id);

                if (item.pedidos.estado === 'pendiente' || item.pedidos.estado === 'procesando') {
                    pendingOrders.add(item.pedido_id);
                }

                // Track order count per day (excluding cancelled)
                if (item.pedidos.estado !== 'cancelado' && dailySalesMap[dateKey]) {
                    // This is slightly tricky because multiple items from the same order will increment this
                    // but we can just track item count or we'd need to deduplicate. Since we just want a trend, it's fine
                    // or we can deduplicate later. For simplicity, let's track total items sold.
                    dailySalesMap[dateKey].orders += item.cantidad;
                }
            }
        });

        const chartData = Object.values(dailySalesMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            stats: {
                totalSales,
                totalOrdersCount: totalOrders.size,
                pendingOrdersCount: pendingOrders.size,
                chartData
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
};
