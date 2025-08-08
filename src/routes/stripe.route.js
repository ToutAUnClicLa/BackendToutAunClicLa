import express from 'express';
import { 
  createCheckoutSession,
  createPaymentIntentFromCart,
  createPaymentIntent, 
  confirmPaymentAndCreateOrder,
  confirmPayment, 
  getPaymentMethods, 
  savePaymentMethod, 
  deletePaymentMethod, 
  handleWebhook,
  getCheckoutSessionStatus,
  getPaymentStatus,
  createRefund
} from '../controllers/stripeController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import Joi from 'joi';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Validation schemas
const createCheckoutSessionSchema = Joi.object({
  shipping_address_id: Joi.string().uuid().required(),
  coupon_code: Joi.string().optional().allow(''),
  success_url: Joi.string().uri().optional(),
  cancel_url: Joi.string().uri().optional()
});

const createPaymentIntentFromCartSchema = Joi.object({
  shipping_address_id: Joi.string().uuid().required(),
  coupon_code: Joi.string().optional().allow('')
});

const createPaymentIntentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().optional()
});

const confirmPaymentAndCreateOrderSchema = Joi.object({
  paymentIntentId: Joi.string().required()
});

const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  paymentMethodId: Joi.string().required()
});

const savePaymentMethodSchema = Joi.object({
  paymentMethodId: Joi.string().required()
});

const createRefundSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  amount: Joi.number().positive().optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').optional()
});

// Webhook route (no auth required)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
// NEW: Stripe Checkout flow (recommended)
router.post('/checkout/create-session', authMiddleware, validateRequest(createCheckoutSessionSchema), createCheckoutSession);
router.get('/checkout/session-status/:sessionId', authMiddleware, getCheckoutSessionStatus);

// LEGACY: Cart-based payment intent flow (for backward compatibility)
router.post('/checkout/payment-intent', authMiddleware, validateRequest(createPaymentIntentFromCartSchema), createPaymentIntentFromCart);
router.post('/checkout/confirm', authMiddleware, validateRequest(confirmPaymentAndCreateOrderSchema), confirmPaymentAndCreateOrder);

// Generic payment intent (for other use cases)
router.post('/payment-intent', authMiddleware, validateRequest(createPaymentIntentSchema), createPaymentIntent);
router.post('/confirm-payment', authMiddleware, validateRequest(confirmPaymentSchema), confirmPayment);

// Payment status and management
router.get('/payment-status/:paymentIntentId', authMiddleware, getPaymentStatus);
router.post('/refund', authMiddleware, validateRequest(createRefundSchema), createRefund);

// Payment methods management
router.get('/payment-methods', authMiddleware, getPaymentMethods);
router.post('/payment-methods', authMiddleware, validateRequest(savePaymentMethodSchema), savePaymentMethod);
router.delete('/payment-methods/:paymentMethodId', authMiddleware, deletePaymentMethod);

export default router;
