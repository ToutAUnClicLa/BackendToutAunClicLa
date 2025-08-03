import express from 'express';
import { register, login, getProfile, verifyEmail, resendVerification, checkVerificationStatus, googleAuth } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest, userRegisterSchema, userLoginSchema, verificationCodeSchema, resendVerificationSchema } from '../middlewares/validation.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import Joi from 'joi';

const router = express.Router();

// Validation schema for Google OAuth
const googleAuthSchema = Joi.object({
  token: Joi.string().required()
});

router.post('/register',authRateLimiter, validateRequest(userRegisterSchema), register);
router.post('/login', authRateLimiter, validateRequest(userLoginSchema), login);
router.post('/google', authRateLimiter, validateRequest(googleAuthSchema), googleAuth);
router.post('/verify-email', authRateLimiter,  validateRequest(verificationCodeSchema), verifyEmail);
router.post('/resend-verification', authRateLimiter,  validateRequest(resendVerificationSchema), resendVerification);
router.get('/verification-status', authRateLimiter, checkVerificationStatus);

// Protected routes
router.get('/profile', authMiddleware, getProfile);

export default router;
