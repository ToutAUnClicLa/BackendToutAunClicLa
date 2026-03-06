import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.development.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'aunclicla@gmail.com';
  const password = 'Quebec2025+';
  const hashedPassword = await bcrypt.hash(password, 12);

  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ 
       password_hash: hashedPassword,
       intentos_login_fallidos: 0,
       cuenta_bloqueada: false
    })
    .eq('correo_electronico', email);

  if (error) {
     console.error('Error updating password:', error);
  } else {
     console.log('Password updated to Quebec2025+ successfully!');
  }
}

run();
