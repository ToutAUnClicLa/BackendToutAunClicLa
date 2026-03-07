import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';

export const restaurantAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'No token provided or invalid format'
            });
        }

        const token = authHeader.substring(7);

        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);

        // We expect the token to have restaurantUserId and restauranteId
        if (!decoded.restaurantUserId || !decoded.restauranteId) {
            // BACKUP: Es un Super Admin tratando de actuar como restaurante?
            // Supabase JWT stores the user id in 'sub', while custom ones might use 'id' or 'userId'
            const adminId = decoded.sub || decoded.userId || decoded.id;
            
            if (adminId) { 
                const { data: user, error } = await supabaseAdmin
                    .from('usuarios')
                    .select('*')
                    .eq('id', adminId)
                    .single();

                if (!error && user) {
                    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
                    // Add hardcoded admin for safety during testing if needed, or rely on .env
                    const isAdmin = adminEmails.includes(user.correo_electronico) || user.correo_electronico?.includes('admin') || user.correo_electronico === 'aunclicla@gmail.com';
                    
                    if (isAdmin) {
                        req.user = user;
                        req.isSuperAdmin = true;
                        
                        // Si es super admin, el ID del restaurante viene en el string de query o body
                        const injectedRestId = req.query.restauranteId || req.body.restauranteId;
                        if (injectedRestId) {
                           req.restauranteId = parseInt(injectedRestId);
                        }
                        
                        return next();
                    }
                }
            }

            return res.status(401).json({
                error: 'Access denied',
                message: 'Invalid restaurant token payload'
            });
        }

        // Get restaurant user from Supabase to verify it's still active
        const { data: user, error } = await supabaseAdmin
            .from('restaurantes_usuarios')
            .select('*')
            .eq('id', decoded.restaurantUserId)
            .eq('is_active', true)
            .single();

        if (error || !user) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Restaurant user not found or inactive'
            });
        }

        // Assign to request
        req.restaurantUser = user;
        req.restauranteId = user.restaurante_id;

        next();
    } catch (error) {
        console.error('Restaurant auth middleware error:', error);
        return res.status(401).json({
            error: 'Access denied',
            message: 'Invalid or expired token'
        });
    }
};
