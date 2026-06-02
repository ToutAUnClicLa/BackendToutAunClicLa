import { supabaseAdmin } from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { COMPANY_INFO } from '../config/companyInfo.js';

// === GESTIÓN DE RESTAURANTES ===

export const getRestaurantProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: profile, error } = await supabaseAdmin
            .from('subcategorias')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json({ profile });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch restaurant profile', message: error.message });
    }
};

export const getAllRestaurantsAdmin = async (req, res) => {
    try {
        // Obtener restaurantes de subcategorias
        const { data: restaurants, error: restErr } = await supabaseAdmin
            .from('subcategorias')
            .select('*')
            .eq('categoria_id', 2)
            .order('nombre', { ascending: true });

        if (restErr) throw restErr;

        // Obtener los usuarios de restaurantes
        const { data: users, error: userErr } = await supabaseAdmin
            .from('restaurantes_usuarios')
            .select('id, restaurante_id, username, is_active, created_at, last_login');

        if (userErr) throw userErr;

        // Cruzar datos
        const fullData = restaurants.map(rest => {
            const accessUser = users.find(u => u.restaurante_id === rest.id);
            return {
                ...rest,
                auth_user: accessUser || null
            };
        });

        res.json({ restaurants: fullData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch restaurants', message: error.message });
    }
};

export const createRestaurant = async (req, res) => {
    try {
        const { nombre, Descripcion, Imagen, nacionalidades } = req.body;

        let parsedNacionalidades = [];
        if (nacionalidades) {
            try {
                parsedNacionalidades = typeof nacionalidades === 'string' ? JSON.parse(nacionalidades) : nacionalidades;
                if (!Array.isArray(parsedNacionalidades)) parsedNacionalidades = [];
            } catch (e) {
                parsedNacionalidades = [];
            }
        }

        // Crear el restaurante en subcategorias
        const { data: newRest, error } = await supabaseAdmin
            .from('subcategorias')
            .insert([{
                nombre,
                Descripcion,
                Imagen,
                nacionalidades: parsedNacionalidades,
                categoria_id: 2, // Comidas/Restaurants
                disponible: false, // Inicia apagado
                dias_abiertos: [0, 1, 2, 3, 4, 5, 6] // Por defecto abre todos los dias
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ message: 'Restaurante creado', restaurant: newRest });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create restaurant', message: error.message });
    }
};

export const deleteRestaurantAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Precautionary manual deletes before deleting the main entry
        await supabaseAdmin.from('productos').delete().eq('subcategoria_id', id);
        await supabaseAdmin.from('restaurantes_usuarios').delete().eq('restaurante_id', id);

        const { error } = await supabaseAdmin
            .from('subcategorias')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Restaurante eliminado permanentemente.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete restaurant', message: error.message });
    }
};

// === GESTIÓN DE CREDENCIALES (USUARIOS DE RESTAURANTES) ===

export const createRestaurantCredentials = async (req, res) => {
    try {
        const { restaurante_id, username, password } = req.body;

        if (!restaurante_id || !username || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { data: newUser, error } = await supabaseAdmin
            .from('restaurantes_usuarios')
            .insert([{
                restaurante_id,
                username,
                password_hash: hashedPassword
            }])
            .select('id, username, restaurante_id, is_active')
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Username already exists' });
            throw error;
        }

        res.status(201).json({ message: 'Credenciales creadas', user: newUser });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create credentials', message: error.message });
    }
};

export const updateRestaurantCredentials = async (req, res) => {
    try {
        const { id } = req.params; // ID de `restaurantes_usuarios`
        const { password, is_active, username } = req.body;

        const updateData = {};
        if (is_active !== undefined) updateData.is_active = is_active;
        if (username !== undefined) updateData.username = username;

        if (password) {
            const saltRounds = 12;
            updateData.password_hash = await bcrypt.hash(password, saltRounds);
        }

        const { data: updatedUser, error } = await supabaseAdmin
            .from('restaurantes_usuarios')
            .update(updateData)
            .eq('id', id)
            .select('id, username, restaurante_id, is_active')
            .single();

        if (error) throw error;

        res.json({ message: 'Credenciales actualizadas', user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update credentials', message: error.message });
    }
};

// === DASHBOARD ESTADÍSTICO GLOBAL ===

export const getGlobalStats = async (req, res) => {
    try {
        const { periodo } = req.query; // e.g: 'week', 'month', 'year', 'all'

        // Determinar fecha de inicio
        let startDate = new Date();
        switch (periodo) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case 'all':
            default:
                startDate = new Date(0); // Desde el principio (1970)
                break;
        }

        const dateFilter = startDate.toISOString();

        // 1. Obtener métricas generales y evolución de los pedidos de toda la app
        // Excluimos cancelados del total de ventas
        const { data: salesData, error: salesErr } = await supabaseAdmin
            .from('pedidos')
            .select('id, total, estado, fecha_pedido')
            .gte('fecha_pedido', dateFilter);

        if (salesErr) throw salesErr;

        let totalSales = 0;
        let totalOrdersCount = salesData.length;
        let pendingOrdersCount = 0;
        const dailyVentas = {};

        salesData.forEach(order => {
            if (['pendiente', 'procesando', 'enviado', 'pagado'].includes(order.estado)) {
                pendingOrdersCount++;
            }

            if (order.estado !== 'cancelado') {
                totalSales += parseFloat(order.total || 0);

                // Agrupar para gráfico (YYYY-MM-DD local timezone simple extract)
                const dateKey = order.fecha_pedido.substring(0, 10);
                if (!dailyVentas[dateKey]) {
                    dailyVentas[dateKey] = { ventas: 0, orderCount: 0 };
                }
                dailyVentas[dateKey].ventas += parseFloat(order.total || 0);
                dailyVentas[dateKey].orderCount += 1;
            }
        });

        // 2. Obtener usuarios registrados y su evolución
        const { data: usersData, error: usersErr } = await supabaseAdmin
            .from('usuarios')
            .select('id, fecha_creacion')
            .gte('fecha_creacion', dateFilter);


        if (usersErr && usersErr.code !== 'PGRST116') {
            console.error('Error getting users:', usersErr);
            throw usersErr;
        }

        const totalUsers = usersData ? usersData.length : 0;

        usersData?.forEach(user => {
            if (user.fecha_creacion) {
                const dateKey = user.fecha_creacion.substring(0, 10);
                if (!dailyVentas[dateKey]) {
                    dailyVentas[dateKey] = { ventas: 0, orderCount: 0, usersCount: 0 };
                }
                dailyVentas[dateKey].usersCount = (dailyVentas[dateKey].usersCount || 0) + 1;
            }
        });

        // Asegurar que si un día tuvo ventas pero no registros de usuario (o viceversa), el objeto tenga todos los valores
        const chartData = Object.keys(dailyVentas)
            .sort() // cronológico
            .map(date => ({
                date,
                value: dailyVentas[date].ventas || 0,
                orders: dailyVentas[date].orderCount || 0,
                users: dailyVentas[date].usersCount || 0
            }));

        // 3. Obtener conteo de restaurantes activos vs inactivos
        const { data: restData, error: restErr } = await supabaseAdmin
            .from('subcategorias')
            .select('id, disponible')
            .eq('categoria_id', 2);

        if (restErr) throw restErr;

        const activeRestaurants = restData.filter(r => r.disponible).length;
        const totalRestaurants = restData.length;

        // Respuesta final agregada
        res.json({
            totalSales,
            totalOrdersCount,
            pendingOrdersCount,
            totalUsers,
            restaurantsObj: { active: activeRestaurants, total: totalRestaurants },
            chartData
        });

    } catch (error) {
        console.error('Error in getGlobalStats:', error);
        res.status(500).json({ error: 'Failed to fetch global stats', message: error.message });
    }
};

// === GESTIÓN DE USUARIOS ===
export const getAllUsers = async (req, res) => {
    try {
        const { data: users, error } = await supabaseAdmin
            .from('usuarios')
            .select('*')
            .order('fecha_creacion', { ascending: false });

        if (error) throw error;
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users', message: error.message });
    }
};

export const toggleUserBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'block' or 'unblock'

        const updateData = {
            cuenta_bloqueada: action === 'block',
            razon_bloqueo: action === 'block' ? (req.body.reason || 'Bloqueado por administrador') : null
        };

        const { data: user, error } = await supabaseAdmin
            .from('usuarios')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: `User ${action}ed successfully`, user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle user status', message: error.message });
    }
};

// === GESTIÓN DE CUPONES ===
export const getAllCouponsAdmin = async (req, res) => {
    try {
        const { data: coupons, error } = await supabaseAdmin
            .from('cupones')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        res.json({ coupons });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch coupons', message: error.message });
    }
};

export const createGlobalCoupon = async (req, res) => {
    try {
        const { codigo, descuento, limite_usos, fecha_expiracion, descripcion } = req.body;

        const { data: coupon, error } = await supabaseAdmin
            .from('cupones')
            .insert([{
                codigo: codigo.toUpperCase().replace(/\s+/g, ''),
                descuento: parseFloat(descuento || 0),
                limite_usos: limite_usos || null,
                fecha_expiracion: fecha_expiracion || null,
                descripcion: descripcion || '',
                activo: true
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'El código de cupón ya existe.' });
            throw error;
        }

        res.status(201).json({ message: 'Coupon created successfully', coupon });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create coupon', message: error.message });
    }
};

export const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;

        const { data: coupon, error } = await supabaseAdmin
            .from('cupones')
            .update({ activo })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: `Coupon status updated`, coupon });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle coupon status', message: error.message });
    }
};

export const deleteGlobalCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('cupones')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete coupon', message: error.message });
    }
};

// === PEDIDOS GLOBALES ===
export const getAllOrdersAdminFormatted = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = '', restauranteId = '' } = req.query;

        let query = supabaseAdmin
            .from('pedidos')
            .select(`
                id, estado, fecha_pedido, total, notas,
                usuarios!inner(nombre, telefono, correo_electronico),
                direcciones_envio(direccion, ciudad, estado, codigo_postal)
            `, { count: 'exact' });

        if (status && status !== 'todos' && status !== '') {
            query = query.eq('estado', status);
        }

        if (restauranteId && restauranteId !== 'todos') {
            const { data: itemsIds, error: itemsErr } = await supabaseAdmin
                .from('detalles_pedido')
                .select('pedido_id, productos!inner(subcategoria_id)')
                .eq('productos.subcategoria_id', restauranteId);

            if (itemsErr) throw itemsErr;

            if (!itemsIds || itemsIds.length === 0) {
                return res.json({ orders: [], total: 0, totalPages: 0, currentPage: parseInt(page) || 1 });
            }

            const orderIds = [...new Set(itemsIds.map(item => item.pedido_id))];
            query = query.in('id', orderIds);
        }

        if (search) {
            const searchNum = parseInt(search);
            if (!isNaN(searchNum) && search.trim() !== '') {
                query = query.eq('id', searchNum);
            } else {
                query = query.or(`nombre.ilike.%${search}%,telefono.ilike.%${search}%,correo_electronico.ilike.%${search}%`, { foreignTable: 'usuarios' });
            }
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const { data: ordersData, count, error: ordersErr } = await query
            .order('fecha_pedido', { ascending: false })
            .range(from, to);

        if (ordersErr) throw ordersErr;

        if (!ordersData || ordersData.length === 0) {
            return res.json({ orders: [], total: 0, totalPages: 0, currentPage: pageNum });
        }

        const finalOrderIds = ordersData.map(o => o.id);

        const { data: finalItems, error: finalItemsErr } = await supabaseAdmin
            .from('detalles_pedido')
            .select('pedido_id, cantidad, precio_unitario, productos!inner(id, nombre, imagen_principal, subcategoria_id, subcategorias(id, nombre))')
            .in('pedido_id', finalOrderIds);

        if (finalItemsErr) throw finalItemsErr;

        const orders = ordersData.map(order => {
            const itemsForThisOrder = finalItems.filter(item => item.pedido_id === order.id);
            const orderTotal = itemsForThisOrder.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);

            return {
                ...order,
                restaurant_total: orderTotal,
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
        res.status(500).json({ error: 'Failed to fetch global orders', message: error.message });
    }
};

export const updateOrderStatusAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStates = ['pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado'];
        if (!allowedStates.includes(status)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        const { data: order, error } = await supabaseAdmin
            .from('pedidos')
            .update({ estado: status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: `Pedido #${id} actualizado a ${status}`, order });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order status', message: error.message });
    }
};

// === FACTURACIÓN ===

/**
 * Devuelve toda la data necesaria para generar la factura de un pedido.
 * Incluye datos de empresa, cliente, dirección, items con impuestos, y totales.
 * Si se pasa ?restauranteId=X, valida que el pedido contenga items de ese
 * restaurante (para que el admin de restaurante solo vea sus propias facturas).
 */
export const getOrderInvoiceData = async (req, res) => {
    try {
        const { id } = req.params;
        const { restauranteId } = req.query;

        // Pedido + cliente + dirección
        const { data: order, error: orderErr } = await supabaseAdmin
            .from('pedidos')
            .select(`
                id, estado, fecha_pedido, fecha_pago, total, subtotal,
                impuestos_tps, impuestos_tvq, costos_envio, descuento,
                codigo_cupon, tipo_cupon, envio_gratis, metodo_entrega, notas_entrega,
                stripe_payment_intent_id, stripe_checkout_session_id,
                usuarios:usuario_id ( nombre, correo_electronico, telefono ),
                direcciones_envio:direccion_envio_id (
                    direccion, ciudad, estado, codigo_postal
                )
            `)
            .eq('id', id)
            .single();

        if (orderErr || !order) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        // Items + producto + tasas de impuesto vigentes
        const { data: items, error: itemsErr } = await supabaseAdmin
            .from('detalles_pedido')
            .select(`
                cantidad, precio_unitario,
                productos:producto_id (
                    id, nombre, TPS, TVQ, subcategoria_id,
                    subcategorias:subcategoria_id ( id, nombre )
                )
            `)
            .eq('pedido_id', id);

        if (itemsErr) throw itemsErr;
        if (!items || items.length === 0) {
            return res.status(404).json({ error: 'El pedido no tiene items' });
        }

        // Si el caller es admin de restaurante, exigir que TODOS los items
        // mostrados pertenezcan a su restaurante (filtra y valida acceso).
        let filteredItems = items;
        if (restauranteId) {
            const restIdNum = parseInt(restauranteId, 10);
            filteredItems = items.filter(it => it.productos?.subcategoria_id === restIdNum);
            if (filteredItems.length === 0) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Este pedido no contiene productos de tu restaurante'
                });
            }
        }

        // Desglose por línea: subtotal, TPS y TVQ exactos
        const invoiceItems = filteredItems.map(it => {
            const unit = parseFloat(it.precio_unitario || 0);
            const qty = parseInt(it.cantidad || 0, 10);
            const lineSubtotal = unit * qty;
            const tpsRate = parseFloat(it.productos?.TPS || 0);
            const tvqRate = parseFloat(it.productos?.TVQ || 0);
            return {
                nombre: it.productos?.nombre || `Producto #${it.productos?.id}`,
                restaurante: it.productos?.subcategorias?.nombre || null,
                cantidad: qty,
                precioUnitario: unit,
                tpsRate,
                tvqRate,
                tps: lineSubtotal * (tpsRate / 100),
                tvq: lineSubtotal * (tvqRate / 100),
                subtotal: lineSubtotal
            };
        });

        // Cuando se filtra por restaurante, recalculamos los totales solo con
        // sus líneas (la factura es parcial). En el caso super-admin (sin
        // filtro), usamos los totales autoritativos guardados en `pedidos`.
        const isPartial = restauranteId != null;
        const totals = isPartial
            ? invoiceItems.reduce((acc, it) => {
                acc.subtotal += it.subtotal;
                acc.tps += it.tps;
                acc.tvq += it.tvq;
                return acc;
            }, { subtotal: 0, tps: 0, tvq: 0 })
            : {
                subtotal: parseFloat(order.subtotal || 0),
                tps: parseFloat(order.impuestos_tps || 0),
                tvq: parseFloat(order.impuestos_tvq || 0)
            };

        // El envío y descuento solo aplican en la factura completa
        const shipping = isPartial ? 0 : parseFloat(order.costos_envio || 0);
        const discount = isPartial ? 0 : parseFloat(order.descuento || 0);
        const total = isPartial
            ? (totals.subtotal + totals.tps + totals.tvq)
            : parseFloat(order.total || 0);

        res.json({
            company: COMPANY_INFO,
            invoice: {
                orderId: order.id,
                isPartial, // true cuando es vista de admin restaurante (subtotal del restaurante)
                status: order.estado,
                date: order.fecha_pago || order.fecha_pedido,
                paymentRef: order.stripe_payment_intent_id || order.stripe_checkout_session_id || null,
                paymentMethod: 'Tarjeta (Stripe)',
                deliveryMethod: order.metodo_entrega || null,
                couponCode: order.codigo_cupon || null,
                freeShipping: !!order.envio_gratis
            },
            customer: {
                name: order.usuarios?.nombre || 'Cliente',
                email: order.usuarios?.correo_electronico || null,
                phone: order.usuarios?.telefono || null
            },
            shippingAddress: order.direcciones_envio ? {
                line1: order.direcciones_envio.direccion,
                city: order.direcciones_envio.ciudad,
                province: order.direcciones_envio.estado,
                postalCode: order.direcciones_envio.codigo_postal
            } : null,
            items: invoiceItems,
            totals: {
                subtotal: totals.subtotal,
                tps: totals.tps,
                tvq: totals.tvq,
                shipping,
                discount,
                total
            }
        });
    } catch (error) {
        console.error('getOrderInvoiceData error:', error);
        res.status(500).json({ error: 'Failed to fetch invoice data', message: error.message });
    }
};
