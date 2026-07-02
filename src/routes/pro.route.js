// =============================================================================
// MÓDULO PRO — Router principal
// Montado en /api/v1/pro. Agrupa las secciones del módulo (auth, perfil, ...)
// por bloques claramente marcados.
// =============================================================================
import express from 'express';
import multer from 'multer';
import Joi from 'joi';
import {
  register,
  login,
  verifyEmail,
  resendVerification,
} from '../controllers/proAuthController.js';
import {
  getMe,
  updateMe,
  getPublicProfile,
  uploadAvatar,
} from '../controllers/proProfileController.js';
import {
  listMine,
  addMine,
  updateMine,
  removeMine,
} from '../controllers/proSocialController.js';
import {
  createCheckout,
  getSubscription,
  syncSubscriptionEndpoint,
  createBillingPortal,
} from '../controllers/proBillingController.js';
import { getCategorias } from '../controllers/proCatalogController.js';
import { requireProAuth } from '../middlewares/proAuth.middleware.js';
import { requireActiveTier } from '../middlewares/proTier.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

// multer en memoria para el avatar (mismo patrón que upload.route.js)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes.'));
  },
});

// ── Schemas de validación ────────────────────────────────────────────────────
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

// PATCH del perfil: todos opcionales, al menos 1. Sin email/tier/slug/password.
const proUpdateSchema = Joi.object({
  nombre: Joi.string().min(2).max(80),
  apellido: Joi.string().max(80).allow(''),
  empresa: Joi.string().max(120).allow(''),
  telefono: Joi.string().max(30).allow(''),
  sitio_web: Joi.string().uri().max(200).allow(''),
  ciudad: Joi.string().max(80).allow(''),
  codigo_postal: Joi.string().max(12).allow(''),
  titulo_fr: Joi.string().max(120).allow(''),
  titulo_en: Joi.string().max(120).allow(''),
  titulo_es: Joi.string().max(120).allow(''),
  bio_fr: Joi.string().max(2000).allow(''),
  bio_en: Joi.string().max(2000).allow(''),
  bio_es: Joi.string().max(2000).allow(''),
  idioma_principal: Joi.string().valid('fr', 'en', 'es'),
  idiomas_hablados: Joi.array().items(Joi.string().max(8)),
  categoria_id: Joi.string().uuid().allow(null),
  subcategoria_id: Joi.string().uuid().allow(null),
}).min(1);

const proSocialCreateSchema = Joi.object({
  plataforma: Joi.string().max(40).required(),
  url: Joi.string().uri().max(300).required(),
  orden: Joi.number().integer().min(0).optional(),
});

const proSocialUpdateSchema = Joi.object({
  plataforma: Joi.string().max(40),
  url: Joi.string().uri().max(300),
  orden: Joi.number().integer().min(0),
}).min(1);

const proCheckoutSchema = Joi.object({
  plan: Joi.string().valid('pro', 'max').required(),
  periodo: Joi.string().valid('mensual', 'anual').required(),
  success_url: Joi.string().uri().optional(),
  cancel_url: Joi.string().uri().optional(),
});

// ── Sección: AUTENTICACIÓN ───────────────────────────────────────────────────
router.post('/register', authRateLimiter, validateRequest(proRegisterSchema), register);
router.post('/login', authRateLimiter, validateRequest(proLoginSchema), login);
router.post('/verify-email', authRateLimiter, validateRequest(proVerifySchema), verifyEmail);
router.post('/resend-verification', authRateLimiter, validateRequest(proResendSchema), resendVerification);

// ── Sección: PERFIL ──────────────────────────────────────────────────────────
// IMPORTANTE: las rutas literales (/me, /me/avatar) van ANTES de /:slug,
// si no, /:slug capturaría "me".
router.get('/me', requireProAuth, getMe);
router.put('/me', requireProAuth, validateRequest(proUpdateSchema), updateMe);
router.post('/me/avatar', requireProAuth, upload.single('file'), uploadAvatar);

// ── Sección: REDES SOCIALES (anidadas al perfil propio) ──────────────────────
// POST requiere plan pro+ (free no tiene perfil público); el tope por tier
// (pro:5, max:∞) se valida en el controlador.
router.get('/me/social', requireProAuth, listMine);
router.post('/me/social', requireProAuth, requireActiveTier('pro'), validateRequest(proSocialCreateSchema), addMine);
router.put('/me/social/:id', requireProAuth, validateRequest(proSocialUpdateSchema), updateMine);
router.delete('/me/social/:id', requireProAuth, removeMine);

// ── Sección: FACTURACIÓN (suscripciones) ─────────────────────────────────────
// Bajo /me para no chocar con GET /:slug. El webhook (Día 7) sincroniza el tier.
router.post('/me/checkout', requireProAuth, validateRequest(proCheckoutSchema), createCheckout);
router.get('/me/subscription', requireProAuth, getSubscription);
router.post('/me/subscription/sync', requireProAuth, syncSubscriptionEndpoint);
router.post('/me/billing-portal', requireProAuth, createBillingPortal);

// ── Sección: CATÁLOGO (público) ──────────────────────────────────────────────
// Antes de /:slug para que la ruta literal no sea capturada como slug.
router.get('/categories', getCategorias);

// Perfil público por slug (sin auth) — SIEMPRE al final
router.get('/:slug', getPublicProfile);

// ── Próximas secciones (Día 8+): tarjetas, directorio, galería ───────────────
// router.use('/cards', proCardRoutes);

export default router;
