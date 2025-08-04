import express from 'express';
import { 
  updateProfile, 
  deleteAccount,
  getAllUsers,
  updateUserStatus,
  setPrimaryAddress
} from '../controllers/userController.js';
import { 
  changePassword 
} from '../controllers/authController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import Joi from 'joi';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  nombre: Joi.string().min(2).required(),
  telefono: Joi.string().optional().allow(''),
  avatarUrl: Joi.string().uri().optional().allow('')
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

const deleteAccountSchema = Joi.object({
  password: Joi.string().required()
});

const updateUserStatusSchema = Joi.object({
  blocked: Joi.boolean().required(),
  reason: Joi.string().when('blocked', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

const setPrimaryAddressSchema = Joi.object({
  addressId: Joi.string().uuid().required()
});

// User routes
router.put('/profile', authMiddleware, validateRequest(updateProfileSchema), updateProfile);
router.put('/password', authMiddleware, validateRequest(changePasswordSchema), changePassword);
router.put('/primary-address', authMiddleware, validateRequest(setPrimaryAddressSchema), setPrimaryAddress);
router.delete('/delete', authMiddleware, validateRequest(deleteAccountSchema), deleteAccount);

// Admin routes
router.get('/', authMiddleware, adminMiddleware, getAllUsers);
router.put('/:id/status', authMiddleware, adminMiddleware, validateRequest(updateUserStatusSchema), updateUserStatus);

export default router;
