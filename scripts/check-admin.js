import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load variables from .env.development.local
dotenv.config({ path: '.env.development.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  const email = 'aunclicla@gmail.com';
  const password = 'Quebe2025+';
  const hashedPassword = await bcrypt.hash(password, 12);

  // 1. Check if user exists in the `usuarios` table
  const { data: user, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('correo_electronico', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Error querying usuarios:", error);
    return;
  }

  if (user) {
    console.log(`User ${email} exists. Updating password hash...`);
    // Update hash to ensure it matches exactly what backend expects
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ password_hash: hashedPassword })
      .eq('id', user.id);
      
    if (updateError) {
      console.error("Failed to update password:", updateError);
    } else {
      console.log("Password updated successfully.");
    }
  } else {
    console.log(`User ${email} does not exist. Creating...`);
    
    // We also need to create them in Supabase Auth to get an ID if strict FKs exist,
    // but looking at auth controller, standard users are in the `usuarios` table.
    
    // Attempt to create in Supabase Auth first
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    
    let userId;
    
    if (authError) {
      if (authError.message.includes('already registered')) {
         console.log('User exists in Supabase Auth but not in public.usuarios table. Fetching...');
         const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
         const match = existingUser.users.find(u => u.email === email);
         if (match) userId = match.id;
      } else {
         console.error("Error creating in Supabase Auth:", authError);
         return;
      }
    } else {
       userId = authData.user.id;
    }
    
    // Create in public.usuarios
    if (userId) {
       const { error: insertError } = await supabaseAdmin
         .from('usuarios')
         .insert([{
            id: userId,
            correo_electronico: email,
            password_hash: hashedPassword,
            nombre: 'Super Admin',
            rol: 'admin',
            verificado: true
         }]);
         
       if (insertError) {
          console.error("Error inserting into public.usuarios:", insertError);
       } else {
          console.log("Super Admin created successfully in public.usuarios.");
       }
    }
  }
}

run();
