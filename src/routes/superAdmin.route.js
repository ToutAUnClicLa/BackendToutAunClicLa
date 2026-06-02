import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import {
    getAllRestaurantsAdmin,
    createRestaurant,
    getRestaurantProfile,
    createRestaurantCredentials,
    updateRestaurantCredentials,
    getGlobalStats,
    getAllUsers,
    toggleUserBlock,
    getAllCouponsAdmin,
    createGlobalCoupon,
    toggleCouponStatus,
    deleteGlobalCoupon,
    deleteRestaurantAdmin,
    getAllOrdersAdminFormatted,
    updateOrderStatusAdmin,
    getOrderInvoiceData
} from '../controllers/superAdminController.js';

const router = Router();

// Protect ALL routes with regular auth AND admin check array
router.use(authMiddleware, adminMiddleware);

// Get all restaurants with their auth users
router.get('/restaurants', getAllRestaurantsAdmin);

// Create a new restaurant in the system
router.post('/restaurants', createRestaurant);

// Delete an existing restaurant from the system
router.delete('/restaurants/:id', deleteRestaurantAdmin);

// Get specific restaurant profile data for deep management
router.get('/restaurants/:id/profile', getRestaurantProfile);

// Create access credentials for a restaurant
router.post('/restaurants/credentials', createRestaurantCredentials);

// Update/Suspend access credentials
router.put('/restaurants/credentials/:id', updateRestaurantCredentials);

// Get global statistics
router.get('/stats', getGlobalStats);

// --- Orders Management ---
router.get('/orders', getAllOrdersAdminFormatted);
router.get('/orders/:id/invoice', getOrderInvoiceData);
router.put('/orders/:id/status', updateOrderStatusAdmin);

// --- User Management ---
router.get('/users', getAllUsers);
router.put('/users/:id/block', toggleUserBlock);

// --- Coupon Management ---
router.get('/coupons', getAllCouponsAdmin);
router.post('/coupons', createGlobalCoupon);
router.put('/coupons/:id/toggle', toggleCouponStatus);
router.delete('/coupons/:id', deleteGlobalCoupon);

export default router;
