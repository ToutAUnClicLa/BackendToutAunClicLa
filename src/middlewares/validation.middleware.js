import Joi from 'joi';

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
        details: error.details
      });
    }
    
    next();
  };
};

// User validation schemas
const userRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  nombre: Joi.string().min(2).required(),
  telefono: Joi.string().optional().allow('')
});

const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Email verification schemas
const verificationCodeSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Must be a valid email address',
    'any.required': 'Email is required for verification'
  }),
  code: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.length': 'Verification code must be exactly 6 digits',
    'string.pattern.base': 'Verification code must contain only numbers',
    'any.required': 'Verification code is required'
  })
});

const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required()
});

// Product validation schemas
const productSchema = Joi.object({
  name: Joi.string().min(3).required(),
  description: Joi.string().required(),
  price: Joi.number().positive().required(),
  categoryId: Joi.number().integer().positive().required(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  stock: Joi.number().integer().min(0).optional().default(0)
});

// Address validation schemas - Completamente flexible para ambos formatos
const addressSchema = Joi.object({
  // === FORMATO BASE DE DATOS (direcciones_envio) ===
  direccion: Joi.string().min(5).max(255).optional(),
  ciudad: Joi.string().min(2).max(100).optional(),
  estado: Joi.string().min(2).max(100).optional(),
  codigo_postal: Joi.string().min(3).max(20).optional(),
  pais: Joi.string().min(2).max(100).optional(),
  telefono: Joi.string().min(8).max(20).optional().allow('', null),
  
  // === FORMATO FRONTEND (compatibilidad) ===
  address: Joi.string().min(5).max(255).optional(),
  city: Joi.string().min(2).max(100).optional(),
  state: Joi.string().min(2).max(100).optional(),
  postalCode: Joi.string().min(3).max(20).optional(),
  country: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().min(8).max(20).optional().allow('', null)
}).custom((value, helpers) => {
  // Validación: debe tener al menos un conjunto completo de datos
  const hasDBFormat = value.direccion && value.ciudad && value.estado && value.codigo_postal && value.pais;
  const hasFrontendFormat = value.address && value.city && value.state && value.postalCode && value.country;
  
  if (!hasDBFormat && !hasFrontendFormat) {
    return helpers.error('any.custom', {
      message: 'Must provide either complete DB format (direccion, ciudad, estado, codigo_postal, pais) or frontend format (address, city, state, postalCode, country)'
    });
  }
  
  return value;
}, 'Complete address validation');

// Review validation schemas
const reviewSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
  estrellas: Joi.number().integer().min(1).max(5).required(),
  comentario: Joi.string().max(1000).optional().allow('', null),
  // Campos alternativos para compatibilidad
  rating: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().max(1000).optional().allow('', null)
}).custom((value, helpers) => {
  // Usar el campo que esté disponible
  const rating = value.estrellas || value.rating;
  const comment = value.comentario || value.comment;
  
  if (!rating) {
    return helpers.error('any.required', { label: 'estrellas or rating' });
  }
  
  // Normalizar al formato de la base de datos
  return {
    ...value,
    estrellas: rating,
    comentario: comment
  };
});

// Cart validation schemas
const cartItemSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
  quantity: Joi.number().integer().min(1).required(),
  horaEntregaPreferida: Joi.string()
    .pattern(/^([12][0-9]|[1-9]):[0-5][0-9]$/)
    .custom((value, helpers) => {
      const [hours, minutes] = value.split(':').map(Number);
      if (hours < 11 || hours > 21) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .default('18:00')
    .messages({
      'string.pattern.base': 'Delivery time must be in HH:MM format',
      'any.invalid': 'Delivery time must be between 11:00 AM and 9:00 PM'
    }),
  metodoEntrega: Joi.string()
    .valid('puerta', 'manos', 'recepcion')
    .default('puerta')
    .messages({
      'any.only': 'Delivery method must be one of: puerta, manos, recepcion'
    }),
  notasEntrega: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
    .messages({
      'string.max': 'Delivery notes cannot exceed 500 characters'
    }),
  tipoEntrega: Joi.string()
    .valid('hoy', 'siguiente_dia', 'estandar')
    .optional()
    .messages({
      'any.only': 'Delivery type must be one of: hoy, siguiente_dia, estandar'
    }),
  variations: Joi.array()
    .items(
      Joi.object({
        variationId: Joi.number().integer().positive().required()
          .messages({
            'any.required': 'Variation ID is required',
            'number.base': 'Variation ID must be a number',
            'number.positive': 'Variation ID must be positive'
          }),
        quantity: Joi.number().integer().min(1).default(1)
          .messages({
            'number.base': 'Variation quantity must be a number',
            'number.min': 'Variation quantity must be at least 1'
          })
      })
    )
    .optional()
    .default([])
    .messages({
      'array.base': 'Variations must be an array'
    })
});

// Delivery options validation schema
const deliveryOptionsSchema = Joi.object({
  horaEntregaPreferida: Joi.string()
    .pattern(/^([12][0-9]|[1-9]):[0-5][0-9]$/)
    .custom((value, helpers) => {
      const [hours, minutes] = value.split(':').map(Number);
      if (hours < 11 || hours > 21) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .default('18:00')
    .messages({
      'string.pattern.base': 'Delivery time must be in HH:MM format',
      'any.invalid': 'Delivery time must be between 11:00 AM and 9:00 PM'
    }),
  metodoEntrega: Joi.string()
    .valid('puerta', 'manos', 'recepcion')
    .default('puerta')
    .messages({
      'any.only': 'Delivery method must be one of: puerta, manos, recepcion'
    }),
  notasEntrega: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
    .messages({
      'string.max': 'Delivery notes cannot exceed 500 characters'
    }),
  aplicarATodos: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'aplicarATodos must be true or false'
    }),
  tipoEntrega: Joi.string()
    .valid('estandar', 'siguiente_dia')
    .optional()
    .messages({
      'any.only': 'Delivery type must be estandar or siguiente_dia'
    })
});

// Favorites validation schemas
const favoriteSchema = Joi.object({
  productId: Joi.number().integer().positive().required()
});

// Coupon validation schemas
const couponSchema = Joi.object({
  couponCode: Joi.string().min(3).max(20).required()
});

// Cart with coupon validation
const cartCouponSchema = Joi.object({
  couponCode: Joi.string().min(3).max(20).optional()
});

export {
  validateRequest,
  userRegisterSchema,
  userLoginSchema,
  verificationCodeSchema,
  resendVerificationSchema,
  productSchema,
  addressSchema,
  reviewSchema,
  cartItemSchema,
  deliveryOptionsSchema,
  favoriteSchema,
  couponSchema,
  cartCouponSchema
};
