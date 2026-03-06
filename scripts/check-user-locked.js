import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('correo_electronico, intentos_login_fallidos, cuenta_bloqueada, fecha_bloqueo')
    .eq('correo_electronico', 'aunclicla@gmail.com')
    .single();

  console.log(data);
  
  if (data?.cuenta_bloqueada || data?.intentos_login_fallidos > 0) {
     console.log('Unlocking user...');
     await supabaseAdmin
        .from('usuarios')
        .update({
           cuenta_bloqueada: false,
           intentos_login_fallidos: 0,
           fecha_bloqueo: null
        })
        .eq('correo_electronico', 'aunclicla@gmail.com');
     console.log('User unlocked!');
  }
}

run();
