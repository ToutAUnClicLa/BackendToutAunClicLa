import { supabaseAdmin } from '../config/supabase.js';

/**
 * Genera un código de cupón único basado en el nombre del usuario
 * Formato: CUPONNOMBRE o CUPONNOMBRE1, CUPONNOMBRE2, etc si ya existe
 */
const generateUniqueCouponCode = async (nombre) => {
  // Limpiar y formatear el nombre para el código
  const baseName = nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^A-Z0-9]/g, '') // Solo letras y números
    .substring(0, 20); // Limitar longitud

  const baseCode = `${baseName}`;

  // Buscar cupones existentes con este código base
  const { data: existingCoupons } = await supabaseAdmin
    .from('cupones')
    .select('codigo')
    .ilike('codigo', `${baseCode}%`)
    .order('codigo', { ascending: false });

  // Si no hay cupones con este código, usar el base
  if (!existingCoupons || existingCoupons.length === 0) {
    return baseCode;
  }

  // Encontrar el siguiente número disponible
  let counter = 1;
  const existingCodes = existingCoupons.map(c => c.codigo);

  while (existingCodes.includes(`${baseCode}${counter}`)) {
    counter++;
  }

  // Si el código base existe, pero no hay numerados, usar el 1
  if (existingCodes.includes(baseCode) && !existingCodes.includes(`${baseCode}1`)) {
    return `${baseCode}1`;
  }

  // Si el código base no existe, usarlo
  if (!existingCodes.includes(baseCode)) {
    return baseCode;
  }

  return `${baseCode}${counter}`;
};

/**
 * Crea un cupón de bienvenida para un usuario nuevo
 */
export const createWelcomeCoupon = async (userId, nombre, email) => {
  try {
    console.log('🎁 Creando cupón de bienvenida para:', email);

    // Generar código único
    const couponCode = await generateUniqueCouponCode(nombre);

    // Calcular fecha de expiración (15 días desde ahora)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 15);

    // Crear el cupón
    const { data: coupon, error } = await supabaseAdmin
      .from('cupones')
      .insert([{
        codigo: couponCode,
        descuento: 0, // Sin descuento en el monto (0 = envío gratis)
        fecha_expiracion: expirationDate.toISOString().split('T')[0], // Solo fecha sin hora
        limite_usos: 5,
        activo: true,
        usuario_asignado: userId,
        descripcion: `Cupón de bienvenida para ${nombre} - Envío gratis`
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creando cupón:', error);
      throw error;
    }

    console.log('✅ Cupón creado exitosamente:', couponCode);
    return coupon;

  } catch (error) {
    console.error('❌ Error en createWelcomeCoupon:', error);
    throw error;
  }
};

/**
 * Obtiene el cupón de bienvenida de un usuario
 */
export const getUserWelcomeCoupon = async (userId) => {
  try {
    const { data: coupon, error } = await supabaseAdmin
      .from('cupones')
      .select('*')
      .eq('usuario_asignado', userId)
      .ilike('descripcion', '%bienvenida%')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    return coupon;
  } catch (error) {
    console.error('❌ Error obteniendo cupón de bienvenida:', error);
    return null;
  }
};