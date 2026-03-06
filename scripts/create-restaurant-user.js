import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../src/config/supabase.js';

// Get args from command line
// Usage: node scripts/create-restaurant-user.js <restaurante_id> <username> <password>
const [, , restauranteId, username, password] = process.argv;

if (!restauranteId || !username || !password) {
    console.error('Uso: node scripts/create-restaurant-user.js <restaurante_id> <username> <password>');
    console.error('Ejemplo: node scripts/create-restaurant-user.js 1 mimarca mi_contraseña_segura');
    process.exit(1);
}

async function createRestaurantUser() {
    try {
        console.log(`Creando usuario "${username}" para el restaurante ID: ${restauranteId}...`);

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user
        const { data, error } = await supabaseAdmin
            .from('restaurantes_usuarios')
            .insert([{
                restaurante_id: parseInt(restauranteId),
                username,
                password_hash: hashedPassword
            }])
            .select('id, username')
            .single();

        if (error) {
            if (error.code === '23505') {
                console.error('❌ Error: El nombre de usuario ya existe.');
            } else if (error.code === '23503') {
                console.error('❌ Error: El restaurante (subcategoria) no existe con ese ID.');
            } else {
                throw error;
            }
            process.exit(1);
        }

        console.log(`✅ Usuario creado con éxito!`);
        console.log(`Ya puedes iniciar sesión en /restaurante/login con:`);
        console.log(`Usuario: ${username}`);
        console.log(`Contraseña: ${password}`);

    } catch (error) {
        console.error('❌ Error inesperado:', error);
    }
}

createRestaurantUser();
