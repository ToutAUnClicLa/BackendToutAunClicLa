import express from 'express';
import { 
  createCheckoutSession,
  handleWebhook,
  getCheckoutSessionStatus,
  createRefund // Solo para casos especiales de reembolso
} from '../controllers/stripeController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import Joi from 'joi';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Validation schemas para Stripe Checkout únicamente
const createCheckoutSessionSchema = Joi.object({
  shipping_address_id: Joi.string().uuid().required(),
  coupon_code: Joi.string().optional().allow(''),
  success_url: Joi.string().optional(),
  cancel_url: Joi.string().optional()
});

const createRefundSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  amount: Joi.number().positive().optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').optional()
});

// Webhook route is handled directly in server.js to preserve raw body

// STRIPE CHECKOUT ROUTES (Simplificado - solo lo necesario)
router.post('/checkout/create-session', authMiddleware, validateRequest(createCheckoutSessionSchema), createCheckoutSession);
router.get('/checkout/session-status/:sessionId', authMiddleware, getCheckoutSessionStatus);

// Refund route (opcional - para casos especiales de admin)
router.post('/refund', authMiddleware, validateRequest(createRefundSchema), createRefund);

export default router;