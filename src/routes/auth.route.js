import express from 'express';
import { register, login, getProfile, verifyEmail, resendVerification, checkVerificationStatus, googleAuth, googleCallback } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest, userRegisterSchema, userLoginSchema, verificationCodeSchema, resendVerificationSchema } from '../middlewares/validation.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import Joi from 'joi';

const router = express.Router();

// Validation schema for Google OAuth with Supabase
const googleAuthSchema = Joi.object({
  access_token: Joi.string().required(),
  refresh_token: Joi.string().optional()
});

// Validation schema for email check
const emailCheckSchema = Joi.object({
  email: Joi.string().email().required()
});

router.post('/register',authRateLimiter, validateRequest(userRegisterSchema), register);
router.post('/login', authRateLimiter, validateRequest(userLoginSchema), login);
router.post('/google', authRateLimiter, validateRequest(googleAuthSchema), googleAuth);
router.get('/google/callback', googleCallback); // Callback de OAuth no necesita rate limiting tan estricto
router.post('/verify-email', authRateLimiter,  validateRequest(verificationCodeSchema), verifyEmail);
router.post('/resend-verification', authRateLimiter,  validateRequest(resendVerificationSchema), resendVerification);
router.post('/verification-status', authRateLimiter, validateRequest(emailCheckSchema), checkVerificationStatus);

// Protected routes
router.get('/profile', authMiddleware, getProfile);

export default router;
