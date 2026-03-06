import { supabaseAdmin } from '../config/supabase.js';
import bcrypt from 'bcryptjs';

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
        const { nombre, Descripcion, Imagen } = req.body;

        // Crear el restaurante en subcategorias
        const { data: newRest, error } = await supabaseAdmin
            .from('subcategorias')
            .insert([{
                nombre,
                Descripcion,
                // Si la imagen enviada es URL, lo dejamos así por ahora.
                // En el frontend forzaremos la subida de archivos seguros.
                Imagen,
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
            if (['pendiente', 'procesando', 'enviado'].includes(order.estado)) {
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
