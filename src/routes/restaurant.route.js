import { Router } from 'express';
import { login, getSession } from '../controllers/restaurantAuthController.js';
import {
    getProfile, updateProfile,
    getProducts, getProduct, createProduct, updateProduct, deleteProduct,
    getOrders, getStats
} from '../controllers/restaurantAdminController.js';
import { restaurantAuthMiddleware } from '../middlewares/restaurantAuth.middleware.js';

const router = Router();

// Auth
router.post('/login', login);
router.get('/session', restaurantAuthMiddleware, getSession);

// Admin Profile
router.get('/profile', restaurantAuthMiddleware, getProfile);
router.put('/profile', restaurantAuthMiddleware, updateProfile);

// Admin Products
router.get('/products', restaurantAuthMiddleware, getProducts);
router.get('/products/:id', restaurantAuthMiddleware, getProduct);
router.post('/products', restaurantAuthMiddleware, createProduct);
router.put('/products/:id', restaurantAuthMiddleware, updateProduct);
router.delete('/products/:id', restaurantAuthMiddleware, deleteProduct);

// Admin Orders & Stats
router.get('/orders', restaurantAuthMiddleware, getOrders);
router.get('/stats', restaurantAuthMiddleware, getStats);

export default router;
