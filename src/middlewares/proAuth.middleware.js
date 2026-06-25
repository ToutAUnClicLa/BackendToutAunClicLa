// =============================================================================
// MÓDULO PRO — Middleware de autenticación
// Valida el JWT del módulo Pro (scope 'pro'), carga el profesional y lo inyecta
// en req.proUser. Un token del e-commerce (sin scope 'pro') es rechazado.
// =============================================================================
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { findProById } from '../services/proService.js';

const requireProAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied', message: 'No token provided or invalid format' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // El token debe ser del módulo Pro
    if (decoded.scope !== 'pro' || !decoded.proId) {
      return res.status(401).json({ error: 'Access denied', message: 'Token no válido para el módulo Pro' });
    }

    const pro = await findProById(decoded.proId);
    if (!pro) {
      return res.status(401).json({ error: 'Access denied', message: 'Profesional no encontrado' });
    }
    if (pro.cuenta_bloqueada) {
      return res.status(403).json({ error: 'Access denied', message: pro.razon_bloqueo || 'Cuenta bloqueada' });
    }

    req.proUser = pro;
    next();
  } catch (error) {
    console.error('Pro auth middleware error:', error);
    return res.status(401).json({ error: 'Access denied', message: 'Token inválido' });
  }
};

export { requireProAuth };
