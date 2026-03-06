import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';

const generateToken = (restaurantUserId, restauranteId) => {
    return jwt.sign(
        { restaurantUserId, restauranteId, role: 'restaurant' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// === LOGIN DE RESTAURANTE ===
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Username and password are required'
            });
        }

        console.log(`🔐 Restaurant Login attempt for: ${username}`);

        const { data: user, error } = await supabaseAdmin
            .from('restaurantes_usuarios')
            .select('*, subcategorias(nombre, Imagen)')
            .eq('username', username)
            .eq('is_active', true)
            .single();

        if (error || !user) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Username or password incorrect'
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Username or password incorrect'
            });
        }

        // Update last login
        await supabaseAdmin
            .from('restaurantes_usuarios')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        const token = generateToken(user.id, user.restaurante_id);

        console.log(`✅ Restaurant Login successful: ${username}`);

        res.json({
            message: 'Login successful',
            token,
            restaurant: {
                id: user.restaurante_id,
                userId: user.id,
                username: user.username,
                nombre: user.subcategorias?.nombre,
                imagen: user.subcategorias?.Imagen
            }
        });

    } catch (error) {
        console.error('❌ Restaurant Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: error.message
        });
    }
};

// === GET CURRENT RESTAURANT USER (Session check) ===
export const getSession = async (req, res) => {
    try {
        const user = req.restaurantUser;

        // Fetch some basic restaurant info too
        const { data: restaurant } = await supabaseAdmin
            .from('subcategorias')
            .select('nombre, Imagen')
            .eq('id', user.restaurante_id)
            .single();

        res.json({
            user: {
                id: user.id,
                restauranteId: user.restaurante_id,
                username: user.username,
                nombre: restaurant?.nombre,
                imagen: restaurant?.Imagen
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get session' });
    }
};
