import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';

/**
 * Middleware para validar tokens de sesión de Supabase
 * Este middleware puede usarse como alternativa al JWT personalizado
 */
export const supabaseAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Buscar datos adicionales del usuario en nuestra tabla personalizada
    const { data: userData, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user data:', userError);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Error retrieving user information'
      });
    }

    // Si no existe en nuestra tabla, crear registro
    if (!userData) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('usuarios')
        .insert([{
          id: user.id,
          auth_user_id: user.id,
          correo_electronico: user.email,
          nombre: user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario',
          url_avatar: user.user_metadata?.avatar_url,
          verificado: true,
          autenticacion_social: true,
          proveedor_social: user.app_metadata?.provider || 'supabase',
          fecha_creacion: user.created_at,
          fecha_ultimo_login: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Error creating user record'
        });
      }

      req.user = newUser;
      req.supabaseUser = user;
    } else {
      // Actualizar última fecha de acceso
      await supabaseAdmin
        .from('usuarios')
        .update({ fecha_ultimo_login: new Date().toISOString() })
        .eq('id', userData.id);

      req.user = userData;
      req.supabaseUser = user;
    }

    next();
  } catch (error) {
    console.error('Supabase auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication verification failed'
    });
  }
};

/**
 * Middleware híbrido que soporta tanto JWT personalizado como tokens de Supabase
 */
export const hybridAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);

    // Intentar primero con JWT personalizado
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Buscar usuario en nuestra tabla
      const { data: user, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      req.user = user;
      req.authMethod = 'jwt';
      return next();
    } catch (jwtError) {
      // Si JWT falla, intentar con token de Supabase
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          throw new Error('Invalid Supabase token');
        }

        // Buscar en nuestra tabla usando auth_user_id
        const { data: userData, error: userError } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

        if (userError && userError.code !== 'PGRST116') {
          throw userError;
        }

        req.user = userData || {
          id: user.id,
          correo_electronico: user.email,
          nombre: user.user_metadata?.full_name || 'Usuario',
          verificado: true
        };
        req.supabaseUser = user;
        req.authMethod = 'supabase';
        return next();
      } catch (supabaseError) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
      }
    }
  } catch (error) {
    console.error('Hybrid auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication verification failed'
    });
  }
};

export default { supabaseAuthMiddleware, hybridAuthMiddleware };
