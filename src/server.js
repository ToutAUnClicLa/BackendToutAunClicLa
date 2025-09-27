import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import './config/env.js';

import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { rateLimiter } from './middlewares/rateLimiter.middleware.js';

// Import routes
import authRoutes from './routes/auth.route.js';
import userRoutes from './routes/users.route.js';
import productRoutes from './routes/products.route.js';
import addressRoutes from './routes/addresses.route.js';
import reviewRoutes from './routes/reviews.route.js';
import cartRoutes from './routes/cart.route.js';
import orderRoutes from './routes/orders.route.js';
import stripeRoutes from './routes/stripe.route.js';
import favoritesRoutes from './routes/favorites.route.js';
import { sendWelcomeEmailsOnStartup } from './utils/sendWelcomeEmails.js';
import arcjectMiddleware from './middlewares/arcjet.middleware.js';
import { startWelcomeEmailMonitor } from './services/welcomeEmailMonitor.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.toutaunclicla.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

// Rate limiting
app.set('trust proxy', 1);
app.use(rateLimiter);

// Logging
app.use(morgan('combined'));

// Import webhook handler directly
import { handleWebhook } from './controllers/stripeController.js';

// Stripe webhook route (BEFORE JSON parsing to preserve raw body)
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Body parsing middleware (applied to all other routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'API is running', 
    timestamp: new Date().toISOString() 
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/stripe', stripeRoutes);
app.use('/api/v1/favorites', favoritesRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation available at http://localhost:${PORT}/health`);

  // Iniciar monitor de emails de bienvenida
  console.log('📧 Iniciando monitor de emails de bienvenida...');
  startWelcomeEmailMonitor();

});

export default app;
