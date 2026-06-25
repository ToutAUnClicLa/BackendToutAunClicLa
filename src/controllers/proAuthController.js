// =============================================================================
// MÓDULO PRO — Controlador de autenticación (auth propia)
// Mismo patrón que authController.js del e-commerce, contra pro_profesionales:
//   - Código de verificación por email SOLO en el registro
//   - Login solo valida el flag 'verificado' (no envía código)
//   - Bloqueo de cuenta tras intentos fallidos
// JWT con scope 'pro' para no mezclarse con los tokens del e-commerce.
// =============================================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { sendProVerificationEmail } from '../config/resend.js';
import {
  findProByEmail,
  createPro,
  updatePro,
  generateUniqueSlug,
  sanitizePro,
} from '../services/proService.js';

const SALT_ROUNDS = 12;
const CODE_TTL_MIN = 15;     // expiración del código de verificación
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_HOURS = 24;

// Token con scope 'pro' (vigencia 7 días)
const generateProToken = (proId) =>
  jwt.sign({ proId, scope: 'pro' }, JWT_SECRET, { expiresIn: '7d' });

const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// === REGISTRO ===============================================================
const register = async (req, res) => {
  try {
    const { email, password, nombre, apellido, telefono, idioma_principal } = req.body;
    const clientIP = req.ip || req.connection?.remoteAddress;

    if (await findProByEmail(email)) {
      return res.status(409).json({
        error: 'Pro already exists',
        message: 'Ya existe un profesional con este email',
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationCode = generateVerificationCode();
    const expiration = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();
    const slug = await generateUniqueSlug(nombre, apellido);

    const pro = await createPro({
      email,
      password_hash: hashedPassword,
      nombre,
      apellido: apellido || null,
      telefono: telefono || null,
      slug,
      idioma_principal: idioma_principal || 'fr',
      token_verificacion_email: verificationCode,
      fecha_expiracion_token: expiration,
      ip_ultimo_acceso: clientIP,
      verificado: false,
      autenticacion_social: false,
    });

    // El envío de email no debe tumbar el registro
    try {
      await sendProVerificationEmail(email, verificationCode, nombre);
    } catch (emailError) {
      console.error('⚠️  Pro: fallo al enviar email de verificación:', emailError);
    }

    return res.status(201).json({
      message: 'Profesional registrado. Revisa tu email para el código de verificación.',
      pro: sanitizePro(pro),
      token: generateProToken(pro.id),
      verificationRequired: true,
    });
  } catch (error) {
    console.error('❌ Pro register error:', error);
    return res.status(500).json({ error: 'Registration failed', message: error.message });
  }
};

// === LOGIN ==================================================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.ip || req.connection?.remoteAddress;

    const pro = await findProByEmail(email);
    if (!pro) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Email o contraseña incorrectos' });
    }

    // Gate de verificación (el código fue solo al registrarse)
    if (!pro.verificado) {
      return res.status(403).json({
        error: 'Account not verified',
        message: 'Verifica tu email antes de iniciar sesión.',
        needsVerification: true,
      });
    }

    // Cuenta bloqueada por intentos fallidos
    if (pro.cuenta_bloqueada) {
      const unlock = new Date(pro.fecha_bloqueo);
      unlock.setHours(unlock.getHours() + LOCK_HOURS);
      if (new Date() < unlock) {
        return res.status(423).json({
          error: 'Account locked',
          message: pro.razon_bloqueo || 'Cuenta bloqueada temporalmente por intentos fallidos.',
          unlockTime: unlock,
        });
      }
      await updatePro(pro.id, {
        cuenta_bloqueada: false, intentos_login_fallidos: 0, fecha_bloqueo: null, razon_bloqueo: null,
      });
    }

    // Cuentas creadas por OAuth no tienen password_hash
    const valid = pro.password_hash ? await bcrypt.compare(password, pro.password_hash) : false;

    if (!valid) {
      const intentos = (pro.intentos_login_fallidos || 0) + 1;
      const patch = { intentos_login_fallidos: intentos };
      if (intentos >= MAX_LOGIN_ATTEMPTS) {
        patch.cuenta_bloqueada = true;
        patch.fecha_bloqueo = new Date().toISOString();
        patch.razon_bloqueo = 'Multiple failed login attempts';
      }
      await updatePro(pro.id, patch);
      return res.status(401).json({ error: 'Invalid credentials', message: 'Email o contraseña incorrectos' });
    }

    const updated = await updatePro(pro.id, {
      last_login: new Date().toISOString(),
      ip_ultimo_acceso: clientIP,
      intentos_login_fallidos: 0,
      cuenta_bloqueada: false,
      fecha_bloqueo: null,
      razon_bloqueo: null,
    });

    return res.json({
      message: 'Login successful',
      token: generateProToken(updated.id),
      pro: sanitizePro(updated),
    });
  } catch (error) {
    console.error('❌ Pro login error:', error);
    return res.status(500).json({ error: 'Login failed', message: error.message });
  }
};

// === VERIFICAR EMAIL ========================================================
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const pro = await findProByEmail(email);

    if (!pro) {
      return res.status(404).json({ error: 'Not found', message: 'Profesional no encontrado' });
    }
    if (pro.verificado) {
      return res.json({ message: 'La cuenta ya está verificada', pro: sanitizePro(pro) });
    }
    if (pro.token_verificacion_email !== code) {
      return res.status(400).json({ error: 'Invalid code', message: 'Código incorrecto' });
    }
    if (new Date(pro.fecha_expiracion_token) < new Date()) {
      return res.status(400).json({ error: 'Code expired', message: 'El código expiró, solicita uno nuevo' });
    }

    const updated = await updatePro(pro.id, {
      verificado: true,
      token_verificacion_email: null,
      fecha_expiracion_token: null,
    });

    return res.json({ message: 'Email verificado correctamente', pro: sanitizePro(updated) });
  } catch (error) {
    console.error('❌ Pro verifyEmail error:', error);
    return res.status(500).json({ error: 'Verification failed', message: error.message });
  }
};

// === REENVIAR CÓDIGO ========================================================
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const pro = await findProByEmail(email);

    if (!pro) {
      return res.status(404).json({ error: 'Not found', message: 'Profesional no encontrado' });
    }
    if (pro.verificado) {
      return res.status(400).json({ error: 'Already verified', message: 'La cuenta ya está verificada' });
    }

    const verificationCode = generateVerificationCode();
    const expiration = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();
    await updatePro(pro.id, {
      token_verificacion_email: verificationCode,
      fecha_expiracion_token: expiration,
    });
    await sendProVerificationEmail(email, verificationCode, pro.nombre);

    return res.json({ message: 'Código de verificación reenviado' });
  } catch (error) {
    console.error('❌ Pro resendVerification error:', error);
    return res.status(500).json({ error: 'Resend failed', message: error.message });
  }
};

// === PERFIL DEL PROFESIONAL AUTENTICADO =====================================
const getMe = async (req, res) => {
  // req.proUser lo inyecta requireProAuth
  return res.json({ pro: sanitizePro(req.proUser) });
};

export { register, login, verifyEmail, resendVerification, getMe };
