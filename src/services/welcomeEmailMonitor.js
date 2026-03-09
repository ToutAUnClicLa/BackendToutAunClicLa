import { supabaseAdmin } from '../config/supabase.js';
import { sendWelcomeEmail } from '../config/resend.js';
import { createWelcomeCoupon, getUserWelcomeCoupon } from './couponService.js';

/**
 * Servicio que monitorea usuarios nuevos verificados y les envía email de bienvenida
 * Se ejecuta periódicamente para asegurar que todos los usuarios verificados reciban su email
 */

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
    // let coupon = await getUserWelcomeCoupon(userId);

    // if (!coupon) {
    //   // Crear cupón de bienvenida
    //   coupon = await createWelcomeCoupon(userId, user.nombre, user.correo_electronico);
    //   console.log('🎁 Cupón creado:', coupon.codigo);
    // }

    // Enviar email de bienvenida
    await sendWelcomeEmail(user.correo_electronico, user.nombre);

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

export default {
  sendWelcomeEmailToUser
};