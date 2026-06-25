// =============================================================================
// MÓDULO PRO — Router principal
// Montado en /api/v1/pro. A medida que crezca el módulo, este archivo agrupará
// las secciones (auth, perfil, tarjetas, etc.) por bloques claramente marcados.
// =============================================================================
import express from 'express';
import Joi from 'joi';
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  getMe,
} from '../controllers/proAuthController.js';
import { requireProAuth } from '../middlewares/proAuth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

// ── Schemas de validación (auth) ────────────────────────────────────────────
const proRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  nombre: Joi.string().min(2).max(80).required(),
  apellido: Joi.string().max(80).optional().allow(''),
  telefono: Joi.string().max(30).optional().allow(''),
  idioma_principal: Joi.string().valid('fr', 'en', 'es').optional(),
});

const proLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const proVerifySchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^[0-9]+$/).required(),
});

const proResendSchema = Joi.object({
  email: Joi.string().email().required(),
});

// ── Sección: AUTENTICACIÓN ───────────────────────────────────────────────────
router.post('/register', authRateLimiter, validateRequest(proRegisterSchema), register);
router.post('/login', authRateLimiter, validateRequest(proLoginSchema), login);
router.post('/verify-email', authRateLimiter, validateRequest(proVerifySchema), verifyEmail);
router.post('/resend-verification', authRateLimiter, validateRequest(proResendSchema), resendVerification);
router.get('/me', requireProAuth, getMe);

// ── Próximas secciones (Día 4+): perfil, redes, tarjetas, directorio ─────────
// router.use('/profile', proProfileRoutes);
// router.use('/cards', proCardRoutes);

export default router;
