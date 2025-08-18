import express from 'express';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart,
  applyCoupon,
  getCartWithCoupon,
  updateDeliveryOptions
} from '../controllers/cartController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest, cartItemSchema, couponSchema, deliveryOptionsSchema } from '../middlewares/validation.middleware.js';
import { couponRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', getCart);
router.get('/with-coupon', getCartWithCoupon);
router.post('/items', validateRequest(cartItemSchema), addToCart);
router.post('/apply-coupon', couponRateLimiter, validateRequest(couponSchema), applyCoupon);
router.put('/items/:id', updateCartItem);
router.put('/delivery-options', validateRequest(deliveryOptionsSchema), updateDeliveryOptions);
router.delete('/items/:id', removeFromCart);
router.delete('/', clearCart);

export default router;
