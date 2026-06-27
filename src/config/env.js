import { config } from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determinar el entorno actual
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

// En desarrollo, cargar desde archivo local
// En producción, usar variables del host
if (IS_DEVELOPMENT) {
    const envFile = path.resolve(__dirname, '../../.env.development.local');
    config({ path: envFile });
    console.log('🔧 Running in DEVELOPMENT mode');
    console.log('📁 Environment file:', envFile);
} else {
    console.log('🚀 Running in PRODUCTION mode');
    console.log('📦 Using host environment variables');
}

// Configurar puerto por defecto
if (!process.env.PORT) {
    process.env.PORT = 5500;
}

// Detectar modo de Stripe
const STRIPE_MODE = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'TEST' : 'LIVE';
const IS_STRIPE_TEST = STRIPE_MODE === 'TEST';

// Log de configuración
console.log(`💳 Stripe Mode: ${STRIPE_MODE}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
console.log(`📧 Admin Emails: ${process.env.ADMIN_EMAILS || 'Not configured'}`);

// Advertencias para modo producción con Stripe TEST
if (IS_PRODUCTION && IS_STRIPE_TEST) {
    console.warn('⚠️  WARNING: Running PRODUCTION with Stripe TEST mode!');
    console.warn('⚠️  Payments will not be real. Configure Stripe LIVE keys for real payments.');
}

// Exportar todas las variables
export const {
    PORT,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    FRONTEND_URL,
    RESEND_API_KEY,
    ADMIN_EMAILS,
    // Módulo Pro — Price IDs de Stripe (suscripciones)
    STRIPE_PRICE_PRO_MENSUAL,
    STRIPE_PRICE_PRO_ANUAL,
    STRIPE_PRICE_MAX_MENSUAL,
    STRIPE_PRICE_MAX_ANUAL
} = process.env;

// Stripe Tax (GST/QST) — desactivado por defecto hasta tener registros fiscales
export const STRIPE_TAX_ENABLED = process.env.STRIPE_TAX_ENABLED === 'true';

// Exportar configuración del entorno
export { 
    NODE_ENV,
    IS_PRODUCTION,
    IS_DEVELOPMENT,
    STRIPE_MODE,
    IS_STRIPE_TEST
};