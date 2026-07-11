import rateLimit from 'express-rate-limit';

const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 400, // limit each IP to 400 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
    validate: {
    trustProxy: false,
    xForwardedForHeader: false // Deshabilita solo esta validación
  }
});

const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 400 : 200, // More attempts in development
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
    validate: {
    trustProxy: false, 
    xForwardedForHeader: false// Deshabilita solo esta validación
  }
});

const couponRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // limit each IP to 10 coupon attempts per windowMs
  message: {
    error: 'Too many coupon attempts',
    message: 'Too many coupon attempts, please try again in 10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
    validate: {
    trustProxy: false, 
    xForwardedForHeader: false// Deshabilita solo esta validación
  },
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?.id || req.ip;
  }
});

// Analytics: permisivo (muchos scanners detrás de un mismo NAT en networking events),
// pero evita floods masivos. Key por IP.
const analyticsRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: {
    error: 'Too many requests',
    message: 'Demasiadas solicitudes, intenta de nuevo en un minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  }
});

export {
  rateLimiter,
  authRateLimiter,
  couponRateLimiter,
  analyticsRateLimiter
};
