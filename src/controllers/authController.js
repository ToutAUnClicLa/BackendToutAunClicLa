import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { JWT_SECRET } from '../config/env.js';
import { sendVerificationEmail, sendWelcomeEmail } from '../config/resend.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// === REGISTRO DE USUARIO ===
const register = async (req, res) => {
  try {
    const { email, password, nombre, telefono } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    console.log('🔐 Registro iniciado para:', email);

    // Validación de entrada
    if (!email || !password || !nombre) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password and name are required'
      });
    }

    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('correo_electronico', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash de la contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generar código de verificación
    const verificationCode = generateVerificationCode();
    const tokenExpiration = new Date();
    tokenExpiration.setMinutes(tokenExpiration.getMinutes() + 15);

    // Crear usuario en la tabla personalizada
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .insert([{
        correo_electronico: email,
        nombre: nombre,
        telefono: telefono || null,
        token_verificacion_email: verificationCode,
        fecha_expiracion_token: tokenExpiration.toISOString(),
        ip_ultimo_acceso: clientIP,
        verificado: false,
        autenticacion_social: false,
        password_hash: hashedPassword
      }])
      .select('id, correo_electronico, nombre, telefono, verificado, fecha_creacion')
      .single();

    if (error) {
      console.error('❌ Error en inserción de usuario:', error);
      throw error;
    }

    console.log('✅ Usuario creado exitosamente:', user.correo_electronico);

    // Enviar email de verificación
    try {
      await sendVerificationEmail(email, verificationCode, nombre);
      console.log('📧 Email de verificación enviado');
    } catch (emailError) {
      console.error('⚠️  Failed to send verification email:', emailError);
      // No falla el registro si el email falla
    }

    // Generar token JWT
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification code.',
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        createdAt: user.fecha_creacion
      },
      token,
      verificationRequired: true
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
};

// === LOGIN DE USUARIO ===
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    console.log('🔐 Login iniciado para:', email);

    // Validación de entrada
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    // Buscar usuario por email
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('correo_electronico', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Verificar si la cuenta está verificada
    if (!user.verificado) {
      return res.status(403).json({
        error: 'Account not verified',
        message: 'Please verify your email address before logging in.',
        needsVerification: true
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.cuenta_bloqueada) {
      const bloqueoExpira = new Date(user.fecha_bloqueo);
      bloqueoExpira.setHours(bloqueoExpira.getHours() + 24);
      
      if (new Date() < bloqueoExpira) {
        return res.status(423).json({
          error: 'Account locked',
          message: user.razon_bloqueo || 'Account is temporarily locked due to multiple failed login attempts.',
          unlockTime: bloqueoExpira
        });
      } else {
        // Reset del bloqueo si ha expirado
        await supabaseAdmin
          .from('usuarios')
          .update({
            cuenta_bloqueada: false,
            intentos_login_fallidos: 0,
            fecha_bloqueo: null,
            razon_bloqueo: null
          })
          .eq('id', user.id);
      }
    }

    // Verificar contraseña
    let isValidPassword = false;
    
    if (user.password_hash) {
      // Usar bcrypt para verificar contraseña
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      // Fallback: si no hay password_hash, usar Supabase Auth
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
          email,
          password
        });
        isValidPassword = !authError && authData;
      } catch (authAttemptError) {
        console.log('⚠️  Error en Supabase Auth:', authAttemptError.message);
      }
    }

    if (!isValidPassword) {
      // Incrementar intentos fallidos
      const intentos = (user.intentos_login_fallidos || 0) + 1;
      const updateData = { intentos_login_fallidos: intentos };

      // Bloquear cuenta después de 5 intentos fallidos
      if (intentos >= 5) {
        updateData.cuenta_bloqueada = true;
        updateData.fecha_bloqueo = new Date().toISOString();
        updateData.razon_bloqueo = 'Multiple failed login attempts';
      }

      await supabaseAdmin
        .from('usuarios')
        .update(updateData)
        .eq('id', user.id);

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Actualizar información de último login y resetear intentos fallidos
    await supabaseAdmin
      .from('usuarios')
      .update({
        fecha_ultimo_login: new Date().toISOString(),
        ip_ultimo_acceso: clientIP,
        intentos_login_fallidos: 0,
        cuenta_bloqueada: false,
        fecha_bloqueo: null,
        razon_bloqueo: null
      })
      .eq('id', user.id);

    // Generar token JWT
    const token = generateToken(user.id);

    console.log('✅ Login exitoso para:', user.correo_electronico);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        createdAt: user.fecha_creacion
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
};

// === VERIFICACIÓN DE EMAIL ===
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Validación manual adicional (ya validado por Joi, pero por seguridad)
    if (!email || !code) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Both email and verification code are required'
      });
    }

    console.log('📧 Verificación de email para:', email, 'con código:', code);

    // Buscar usuario por email Y código de verificación
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('correo_electronico', email)
      .eq('token_verificacion_email', code)
      .single();

    if (error || !user) {
      return res.status(400).json({
        error: 'Invalid verification',
        message: 'Email and verification code combination is invalid or expired'
      });
    }

    // Verificar si el código ha expirado
    const tokenExpiration = new Date(user.fecha_expiracion_token);
    if (new Date() > tokenExpiration) {
      return res.status(400).json({
        error: 'Code expired',
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Verificar el usuario
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        verificado: true,
        token_verificacion_email: null,
        fecha_expiracion_token: null,
        fecha_verificacion: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Usuario verificado exitosamente:', user.correo_electronico);

    // Enviar email de bienvenida
    try {
      await sendWelcomeEmail(user.correo_electronico, user.nombre);
    } catch (emailError) {
      console.error('⚠️  Failed to send welcome email:', emailError);
    }

    res.json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        verified: true
      }
    });
  } catch (error) {
    console.error('❌ Verify email error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error.message
    });
  }
};

// === OBTENER PERFIL DE USUARIO ===
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        createdAt: user.fecha_creacion,
        lastLogin: user.fecha_ultimo_login,
        avatarUrl: user.url_avatar
      }
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: error.message
    });
  }
};

// === CAMBIO DE CONTRASEÑA ===
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'New password must be at least 8 characters long'
      });
    }

    // Obtener usuario actual
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Verificar contraseña actual
    if (user.password_hash) {
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrentPassword) {
        return res.status(401).json({
          error: 'Invalid current password',
          message: 'Current password is incorrect'
        });
      }
    } else {
      return res.status(400).json({
        error: 'Password change not available',
        message: 'Password change is not available for this account type'
      });
    }

    // Hash de la nueva contraseña
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        password_hash: hashedNewPassword,
        fecha_cambio_contrasena: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Contraseña cambiada exitosamente para usuario:', userId);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
};

// === ACTUALIZAR PERFIL ===
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, telefono } = req.body;

    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (telefono) updateData.telefono = telefono;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No data to update',
        message: 'Please provide at least one field to update'
      });
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('usuarios')
      .update(updateData)
      .eq('id', userId)
      .select('id, correo_electronico, nombre, telefono, verificado, fecha_creacion')
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.correo_electronico,
        nombre: updatedUser.nombre,
        telefono: updatedUser.telefono,
        verified: updatedUser.verificado,
        createdAt: updatedUser.fecha_creacion
      }
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
};

// === REENVIAR CÓDIGO DE VERIFICACIÓN ===
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required'
      });
    }

    // Buscar usuario por email
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('correo_electronico', email)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this email'
      });
    }

    // Verificar si ya está verificado
    if (user.verificado) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This account is already verified'
      });
    }

    // Generar nuevo código de verificación
    const verificationCode = generateVerificationCode();
    const tokenExpiration = new Date();
    tokenExpiration.setMinutes(tokenExpiration.getMinutes() + 15);

    // Actualizar código en la base de datos
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        token_verificacion_email: verificationCode,
        fecha_expiracion_token: tokenExpiration.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Enviar email de verificación
    try {
      await sendVerificationEmail(email, verificationCode, user.nombre);
      console.log('📧 Código de verificación reenviado');
    } catch (emailError) {
      console.error('⚠️  Failed to resend verification email:', emailError);
      return res.status(500).json({
        error: 'Failed to send email',
        message: 'Could not send verification email'
      });
    }

    res.json({
      message: 'Verification code resent successfully'
    });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({
      error: 'Failed to resend verification',
      message: error.message
    });
  }
};

// === VERIFICAR ESTADO DE VERIFICACIÓN ===
const checkVerificationStatus = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required'
      });
    }

    // Buscar usuario por email
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('verificado, correo_electronico, nombre')
      .eq('correo_electronico', email)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this email'
      });
    }

    res.json({
      verified: user.verificado,
      email: user.correo_electronico,
      nombre: user.nombre
    });
  } catch (error) {
    console.error('❌ Check verification status error:', error);
    res.status(500).json({
      error: 'Failed to check verification status',
      message: error.message
    });
  }
};

// === AUTENTICACIÓN CON GOOGLE (SUPABASE) ===
const googleAuth = async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!access_token) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Google access token is required'
      });
    }

    console.log('🔐 Autenticación con Google (Supabase) iniciada');

    // Obtener datos del usuario usando el access_token de Supabase
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(access_token);

    if (authError) {
      console.error('❌ Error obteniendo usuario de Supabase:', authError);
      return res.status(401).json({
        error: 'Google authentication failed',
        message: authError.message
      });
    }

    if (!supabaseUser) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'No user data received from Google'
      });
    }

    console.log('✅ Datos de usuario obtenidos para:', supabaseUser.email);

    // Buscar si el usuario ya existe en nuestra tabla personalizada
    const { data: existingUser, error: searchError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('correo_electronico', supabaseUser.email)
      .single();

    let user;

    if (searchError?.code === 'PGRST116' || !existingUser) {
      // Usuario no existe, crear nuevo usuario en nuestra tabla
      console.log('📝 Creando nuevo usuario con Google:', supabaseUser.email);

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert([{
          id: supabaseUser.id, // Usar el mismo ID de Supabase Auth
          correo_electronico: supabaseUser.email,
          nombre: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || 'Usuario',
          url_avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
          verificado: true, // Google ya verificó el email
          autenticacion_social: true,
          proveedor_social: 'google',
          google_id: supabaseUser.user_metadata?.sub,
          ip_ultimo_acceso: clientIP,
          fecha_verificacion: new Date().toISOString(),
          fecha_ultimo_login: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (insertError) {
        console.error('❌ Error creando usuario con Google:', insertError);
        throw insertError;
      }

      user = newUser;

      // Enviar email de bienvenida
      try {
        await sendWelcomeEmail(supabaseUser.email, user.nombre);
        console.log('📧 Email de bienvenida enviado');
      } catch (emailError) {
        console.error('⚠️  Failed to send welcome email:', emailError);
      }

      console.log('✅ Usuario creado exitosamente con Google:', supabaseUser.email);
    } else if (searchError) {
      throw searchError;
    } else {
      // Usuario existe, actualizar información y hacer login
      console.log('🔄 Usuario existente, actualizando información:', supabaseUser.email);

      // Verificar si la cuenta está bloqueada
      if (existingUser.cuenta_bloqueada) {
        const bloqueoExpira = new Date(existingUser.fecha_bloqueo);
        bloqueoExpira.setHours(bloqueoExpira.getHours() + 24);
        
        if (new Date() < bloqueoExpira) {
          return res.status(423).json({
            error: 'Account locked',
            message: `Account is locked until ${bloqueoExpira.toLocaleString()}. Reason: ${existingUser.razon_bloqueo}`
          });
        } else {
          // Desbloquear cuenta si el tiempo ha expirado
          await supabaseAdmin
            .from('usuarios')
            .update({
              cuenta_bloqueada: false,
              fecha_bloqueo: null,
              razon_bloqueo: null
            })
            .eq('id', existingUser.id);
        }
      }

      // Actualizar información del usuario
      const updateData = {
        fecha_ultimo_login: new Date().toISOString(),
        ip_ultimo_acceso: clientIP,
        intentos_login_fallidos: 0
      };

      // Si el usuario no tenía autenticación social, actualizarlo
      if (!existingUser.autenticacion_social) {
        updateData.autenticacion_social = true;
        updateData.proveedor_social = 'google';
        updateData.google_id = supabaseUser.user_metadata?.sub;
        updateData.verificado = true;
        updateData.fecha_verificacion = new Date().toISOString();
      }

      // Actualizar avatar si Google tiene uno más reciente
      const newAvatar = supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture;
      if (newAvatar && newAvatar !== existingUser.url_avatar) {
        updateData.url_avatar = newAvatar;
      }

      // Actualizar nombre si está vacío o ha cambiado
      const newName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name;
      if (newName && (!existingUser.nombre || existingUser.nombre === 'Usuario')) {
        updateData.nombre = newName;
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('usuarios')
        .update(updateData)
        .eq('id', existingUser.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      user = updatedUser;
      console.log('✅ Login exitoso con Google para:', supabaseUser.email);
    }

    // Generar token JWT personalizado para nuestra aplicación
    const jwtToken = generateToken(user.id);

    res.json({
      message: 'Google authentication successful',
      token: jwtToken,
      supabaseSession: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at
      },
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        avatarUrl: user.url_avatar,
        createdAt: user.fecha_creacion,
        socialAuth: true,
        provider: 'google'
      }
    });
  } catch (error) {
    console.error('❌ Google authentication error:', error);
    
    // Manejar errores específicos de Supabase
    if (error.message && error.message.includes('Invalid token')) {
      return res.status(401).json({
        error: 'Invalid Google token',
        message: 'The provided Google token is invalid or expired'
      });
    }

    res.status(500).json({
      error: 'Google authentication failed',
      message: error.message
    });
  }
};

// === CALLBACK PARA AUTENTICACIÓN CON GOOGLE ===
const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
        message: 'Authorization code is required'
      });
    }

    console.log('🔐 Procesando callback de Google OAuth');

    // Intercambiar el código por tokens usando Supabase
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('❌ Error intercambiando código por sesión:', authError);
      return res.status(400).json({
        error: 'Code exchange failed',
        message: authError.message
      });
    }

    const supabaseUser = authData.user;
    const session = authData.session;

    if (!supabaseUser || !session) {
      return res.status(400).json({
        error: 'Authentication failed',
        message: 'No user or session data received'
      });
    }

    console.log('✅ Sesión creada para:', supabaseUser.email);

    // Procesar el usuario igual que en googleAuth
    const { data: existingUser, error: searchError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('correo_electronico', supabaseUser.email)
      .single();

    let user;

    if (searchError?.code === 'PGRST116' || !existingUser) {
      // Crear nuevo usuario
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert([{
          id: supabaseUser.id,
          correo_electronico: supabaseUser.email,
          nombre: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || 'Usuario',
          url_avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
          verificado: true,
          autenticacion_social: true,
          proveedor_social: 'google',
          google_id: supabaseUser.user_metadata?.sub,
          ip_ultimo_acceso: clientIP,
          fecha_verificacion: new Date().toISOString(),
          fecha_ultimo_login: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      user = newUser;

      // Enviar email de bienvenida
      try {
        await sendWelcomeEmail(supabaseUser.email, user.nombre);
      } catch (emailError) {
        console.error('⚠️  Failed to send welcome email:', emailError);
      }
    } else {
      // Actualizar usuario existente
      const updateData = {
        fecha_ultimo_login: new Date().toISOString(),
        ip_ultimo_acceso: clientIP,
        intentos_login_fallidos: 0
      };

      if (!existingUser.autenticacion_social) {
        updateData.autenticacion_social = true;
        updateData.proveedor_social = 'google';
        updateData.google_id = supabaseUser.user_metadata?.sub;
        updateData.verificado = true;
        updateData.fecha_verificacion = new Date().toISOString();
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('usuarios')
        .update(updateData)
        .eq('id', existingUser.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      user = updatedUser;
    }

    // Generar JWT personalizado
    const jwtToken = generateToken(user.id);

    // Respuesta con datos de sesión
    res.json({
      message: 'Google authentication successful',
      token: jwtToken,
      supabaseSession: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
      },
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        avatarUrl: user.url_avatar,
        createdAt: user.fecha_creacion,
        socialAuth: true,
        provider: 'google'
      }
    });
  } catch (error) {
    console.error('❌ Google callback error:', error);
    res.status(500).json({
      error: 'Google callback failed',
      message: error.message
    });
  }
};

export {
  register,
  login,
  verifyEmail,
  getProfile,
  changePassword,
  updateProfile,
  resendVerification,
  checkVerificationStatus,
  googleAuth,
  googleCallback
};
