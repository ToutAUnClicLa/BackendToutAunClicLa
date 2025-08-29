import emailService from '../services/emailService.js';
import { supabaseAdmin } from '../config/supabase.js';

// Lista manual de emails a los que enviar el correo de bienvenida
const WELCOME_EMAIL_LIST = [
  // Agrega aquí los 20 emails manualmente
  // ... agregar los 20 emails aquí
];

export const sendWelcomeEmailsOnStartup = async () => {
  console.log('🎉 Iniciando envío de emails de bienvenida...');
  console.log(`📧 Enviando a ${WELCOME_EMAIL_LIST.length} usuarios`);
  
  const results = [];
  
  for (const email of WELCOME_EMAIL_LIST) {
    try {
      // Buscar usuario por email
      const { data: user, error: userError } = await supabaseAdmin
        .from('usuarios')
        .select('id, correo_electronico, nombre')
        .eq('correo_electronico', email.toLowerCase().trim())
        .single();

      if (userError || !user) {
        console.log(`❌ Usuario no encontrado: ${email}`);
        results.push({
          email: email,
          success: false,
          error: `User not found: ${email}`
        });
        continue;
      }

      // Enviar email de bienvenida
      const emailResult = await emailService.sendWelcomeEmail(user.id);
      
      if (emailResult.success) {
        console.log(`✅ Email enviado exitosamente a: ${email} (${user.nombre})`);
      } else {
        console.log(`❌ Error enviando email a: ${email} - ${emailResult.error}`);
      }
      
      results.push({
        email: email,
        success: emailResult.success,
        emailId: emailResult.emailId,
        error: emailResult.error || null,
        user: {
          id: user.id,
          name: user.nombre
        }
      });

      // Pausa de 2 segundos entre emails para no saturar el servicio
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log(`❌ Error procesando ${email}:`, error.message);
      results.push({
        email: email,
        success: false,
        error: error.message
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n📊 RESUMEN DE ENVÍO DE EMAILS DE BIENVENIDA:');
  console.log(`✅ Exitosos: ${successful}`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log(`📧 Total: ${WELCOME_EMAIL_LIST.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Emails fallidos:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.email}: ${result.error}`);
    });
  }
  
  console.log('\n🎉 Envío de emails de bienvenida completado!\n');
  
  return results;
};