import express from 'express';
import { 
  getUserOrders, 
  getOrderById, 
  createOrder, 
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getUserOrderStats
} from '../controllers/orderController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import Joi from 'joi';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Validation schemas
const createOrderSchema = Joi.object({
  addressId: Joi.string().uuid().required(),
  paymentMethodId: Joi.string().required()
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('pendiente', 'procesando', 'enviado', 'entregado', 'cancelado', 'pagado').required()
});

// User routes
router.get('/my-orders', authMiddleware, getUserOrders);
router.get('/stats/summary', authMiddleware, getUserOrderStats);
router.get('/:id', authMiddleware, getOrderById);
router.post('/', authMiddleware, validateRequest(createOrderSchema), createOrder);
router.put('/:id/cancel', authMiddleware, cancelOrder);

// Admin routes
router.get('/', authMiddleware, adminMiddleware, getAllOrders);
router.put('/:id/status', authMiddleware, adminMiddleware, validateRequest(updateOrderStatusSchema), updateOrderStatus);

export default router;
