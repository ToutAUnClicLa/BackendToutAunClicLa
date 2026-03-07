import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'No token provided or invalid format' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from Supabase
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'Invalid token or user not found' 
      });
    }

    // Check if user account is blocked
    if (user.cuenta_bloqueada) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: user.razon_bloqueo || 'Account is blocked' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      error: 'Access denied', 
      message: 'Invalid token' 
    });
  }
};

// Since there's no role field in the new schema, we'll create a simple admin check
// You can modify this based on your admin identification logic
const adminMiddleware = (req, res, next) => {
  // For now, we'll check if the user email contains 'admin' or is in a predefined list
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  
  if (req.user && (
    req.user.correo_electronico.includes('admin') || 
    adminEmails.includes(req.user.correo_electronico) ||
    req.user.correo_electronico === 'aunclicla@gmail.com'
  )) {
    next();
  } else {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
  }
};

export {
  authMiddleware,
  adminMiddleware
};
