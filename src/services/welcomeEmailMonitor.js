import { supabaseAdmin } from '../config/supabase.js';
import { sendWelcomeEmail } from '../config/resend.js';
import { createWelcomeCoupon, getUserWelcomeCoupon } from './couponService.js';

/**
 * Servicio que monitorea usuarios nuevos verificados y les envía email de bienvenida
 * Se ejecuta periódicamente para asegurar que todos los usuarios verificados reciban su email
 */

// Almacenar usuarios ya procesados para evitar duplicados
const processedUsers = new Set();

/**
 * Verifica y envía emails de bienvenida a usuarios verificados que no lo han recibido
 */
export const checkAndSendWelcomeEmails = async () => {
  try {
    console.log('🔍 Verificando usuarios para email de bienvenida...');

    // Obtener usuarios verificados creados en las últimas 24 horas que NO hayan recibido email
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: recentUsers, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('verificado', true)
      .gte('fecha_creacion', twentyFourHoursAgo.toISOString())
      .or('email_bienvenida_enviado.is.null,email_bienvenida_enviado.eq.false')
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      return;
    }

    if (!recentUsers || recentUsers.length === 0) {
      console.log('✅ No hay usuarios nuevos verificados');
      return;
    }

    console.log(`📊 Encontrados ${recentUsers.length} usuarios verificados recientes`);

    for (const user of recentUsers) {
      // Evitar procesar el mismo usuario múltiples veces
      if (processedUsers.has(user.id)) {
        continue;
      }

      try {
        // Verificar si el usuario ya tiene un cupón de bienvenida
        let coupon = await getUserWelcomeCoupon(user.id);

        if (!coupon) {
          console.log(`🎁 Creando cupón para ${user.nombre} (${user.correo_electronico})`);

          // Crear cupón de bienvenida
          coupon = await createWelcomeCoupon(user.id, user.nombre, user.correo_electronico);

          // Enviar email de bienvenida con el cupón
          await sendWelcomeEmail(user.correo_electronico, user.nombre, coupon.codigo);

          console.log(`✅ Email de bienvenida enviado a ${user.correo_electronico} con cupón ${coupon.codigo}`);

          // Marcar usuario como procesado
          processedUsers.add(user.id);

          // Registrar en la base de datos que se envió el email
          await supabaseAdmin
            .from('usuarios')
            .update({
              email_bienvenida_enviado: true,
              fecha_email_bienvenida: new Date().toISOString()
            })
            .eq('id', user.id);

        } else {
          console.log(`ℹ️ Usuario ${user.correo_electronico} ya tiene cupón: ${coupon.codigo}`);

          // Verificar si necesita reenvío del email
          if (!user.email_bienvenida_enviado) {
            await sendWelcomeEmail(user.correo_electronico, user.nombre, coupon.codigo);
            console.log(`📧 Email de bienvenida reenviado a ${user.correo_electronico}`);

            await supabaseAdmin
              .from('usuarios')
              .update({
                email_bienvenida_enviado: true,
                fecha_email_bienvenida: new Date().toISOString()
              })
              .eq('id', user.id);
          }

          processedUsers.add(user.id);
        }

      } catch (userError) {
        console.error(`❌ Error procesando usuario ${user.correo_electronico}:`, userError);
      }

      // Pequeña pausa entre emails para no saturar el servicio
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Verificación de emails de bienvenida completada');

  } catch (error) {
    console.error('❌ Error en checkAndSendWelcomeEmails:', error);
  }
};

/**
 * Función para enviar email de bienvenida inmediatamente a un usuario específico
 * Útil para llamar después de registro/verificación
 */
export const sendWelcomeEmailToUser = async (userId) => {
  try {
    // Obtener datos del usuario
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('❌ Usuario no encontrado:', userId);
      return { success: false, error: 'Usuario no encontrado' };
    }

    // Solo enviar si el usuario está verificado
    if (!user.verificado) {
      console.log('⚠️ Usuario no verificado, no se envía email de bienvenida');
      return { success: false, error: 'Usuario no verificado' };
    }

    // Verificar si ya se envió el email de bienvenida
    if (user.email_bienvenida_enviado === true) {
      console.log('ℹ️ Email de bienvenida ya fue enviado anteriormente a:', user.correo_electronico);
      return {
        success: true,
        alreadySent: true,
        message: 'Email ya fue enviado anteriormente'
      };
    }

    // Verificar si ya tiene cupón
    let coupon = await getUserWelcomeCoupon(userId);

    if (!coupon) {
      // Crear cupón de bienvenida
      coupon = await createWelcomeCoupon(userId, user.nombre, user.correo_electronico);
      console.log('🎁 Cupón creado:', coupon.codigo);
    }

    // Enviar email de bienvenida
    await sendWelcomeEmail(user.correo_electronico, user.nombre, coupon.codigo);

    // Actualizar estado en la base de datos
    await supabaseAdmin
      .from('usuarios')
      .update({
        email_bienvenida_enviado: true,
        fecha_email_bienvenida: new Date().toISOString()
      })
      .eq('id', userId);

    console.log(`✅ Email de bienvenida enviado exitosamente a ${user.correo_electronico}`);

    return {
      success: true,
      couponCode: coupon.codigo,
      email: user.correo_electronico
    };

  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Inicia el monitor que verifica periódicamente usuarios nuevos
 * Se ejecuta cada 5 minutos
 */
export const startWelcomeEmailMonitor = () => {
  console.log('🚀 Iniciando monitor de emails de bienvenida...');

  // Ejecutar inmediatamente al iniciar
  checkAndSendWelcomeEmails();

  // Ejecutar cada 5 minutos
  const interval = setInterval(() => {
    checkAndSendWelcomeEmails();
  }, 5 * 60 * 1000); // 5 minutos

  return interval;
};

export default {
  checkAndSendWelcomeEmails,
  sendWelcomeEmailToUser,
  startWelcomeEmailMonitor
};