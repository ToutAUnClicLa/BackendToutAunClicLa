import { supabaseAdmin } from '../config/supabase.js';

// === VALIDACIÓN DE CÓDIGOS POSTALES ===
const validatePostalCode = (postalCode) => {
  if (!postalCode) return false;
  
  const cleanPostalCode = postalCode.replace(/\s/g, '').toUpperCase();
  
  // Códigos postales de Montreal
  const montrealCodes = [
    'H1N', 'H1M', 'H1P', 'H1H', 'H1R', 'H1S', 'H1T', 'H1V', 'H1W', 'H1X', 'H1K',
    'H8Z', 'H8Y', 'H8T', 'H8S', 'H8R', 'H8N', 'H8P', 'H9R', 'H9S', 'H9G', 
    'H9A', 'H9B', 'H9P'
  ];
  
  // Códigos postales con asterisco (todos los que comienzan con estos prefijos)
  const montrealPrefixes = ['H2', 'H3', 'H4'];
  
  // Códigos postales de Rivera Sur
  const riveraSurCodes = [
    'J5R', 'J4B', 'J3Y', 'J4N', 'J4M', 'J4G', 'J4L', 'J4J', 'J4H', 'J4K', 
    'J4T', 'J4V', 'J4R', 'J4Z', 'J4S', 'J4W', 'J4X', 'J4Y', 'J3Z',
    // Nuevas ciudades de domicilio
    'J3V', // Saint-Bruno-de-Montarville
    'J3X', // Varennes
    'J3L', // Chambly
    'J5C', // Sainte-Catherine
    'J3E', // Saint-Julie
    'J3G', // Beloeil
    'J5A', // Saint-Constant
    'J5B', // Delson
    'J0L', // Saint-Philippe
    'J2W', // Saint-Jean-sur-Richelieu
    'J2X', // Saint-Jean-sur-Richelieu
    'J2Y', // Saint-Jean-sur-Richelieu
    'J3A', // Saint-Jean-sur-Richelieu
    'J3B'  // Saint-Jean-sur-Richelieu
  ];
  
  // Verificar códigos específicos de Montreal
  const first3 = cleanPostalCode.substring(0, 3);
  if (montrealCodes.includes(first3)) {
    return true;
  }
  
  // Verificar códigos con prefijo (H2*, H3*, H4*)
  const first2 = cleanPostalCode.substring(0, 2);
  if (montrealPrefixes.includes(first2)) {
    return true;
  }
  
  // Verificar códigos de Rivera Sur
  if (riveraSurCodes.includes(first3)) {
    return true;
  }
  
  return false;
};

// === OBTENER DIRECCIONES DEL USUARIO ===
const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener las direcciones del usuario y su dirección principal
    const [addressesResult, userResult] = await Promise.all([
      supabaseAdmin
        .from('direcciones_envio')
        .select('*')
        .eq('usuario_id', userId)
        .order('id', { ascending: false }),
      supabaseAdmin
        .from('usuarios')
        .select('direccion_principal_id')
        .eq('id', userId)
        .single()
    ]);

    const { data: addresses, error: addressesError } = addressesResult;
    const { data: user, error: userError } = userResult;

    if (addressesError) {
      throw addressesError;
    }

    if (userError) {
      console.error('User data error (non-critical):', userError);
    }

    const primaryAddressId = user?.direccion_principal_id;

    // Formatear respuesta para compatibilidad con frontend
    const formattedAddresses = addresses.map(addr => ({
      id: addr.id,
      // Campos de la base de datos
      direccion: addr.direccion,
      ciudad: addr.ciudad,
      estado: addr.estado,
      codigo_postal: addr.codigo_postal,
      pais: addr.pais,
      // Campos alternativos para compatibilidad
      address: addr.direccion,
      city: addr.ciudad,
      state: addr.estado,
      postalCode: addr.codigo_postal,
      country: addr.pais,
      isPrimary: addr.id === primaryAddressId
    }));

    res.json({ 
      addresses: formattedAddresses,
      count: formattedAddresses.length,
      primaryAddressId
    });
  } catch (error) {
    console.error('❌ Get addresses error:', error);
    res.status(500).json({
      error: 'Failed to get addresses',
      message: error.message
    });
  }
};

// === CREAR NUEVA DIRECCIÓN ===
const createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Extraer campos de ambos formatos (DB y frontend)
    const {
      // Campos de la base de datos
      direccion,
      ciudad,
      estado,
      codigo_postal,
      pais,
      // Campos alternativos del frontend
      address,
      city,
      state,
      postalCode,
      country,
    } = req.body;

    // Mapear campos del frontend a la base de datos
    const addressData = {
      direccion: direccion || address,
      ciudad: ciudad || city,
      estado: estado || state,
      codigo_postal: codigo_postal || postalCode,
      pais: pais || country
    };

    // Validar campos requeridos según la base de datos
    if (!addressData.direccion || !addressData.ciudad || !addressData.estado || !addressData.codigo_postal || !addressData.pais) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'direccion, ciudad, estado, codigo_postal, and pais are required'
      });
    }

    // Validar que el país sea Canadá y la provincia sea Quebec
    if (addressData.pais.toLowerCase() !== 'canada' && addressData.pais.toLowerCase() !== 'canadá') {
      return res.status(400).json({
        error: 'Invalid country',
        message: 'Solo se permiten direcciones en Canadá'
      });
    }

    if (addressData.estado.toLowerCase() !== 'quebec' && addressData.estado.toLowerCase() !== 'québec') {
      return res.status(400).json({
        error: 'Invalid province',
        message: 'Solo se permiten direcciones en la provincia de Quebec'
      });
    }

    // Validar código postal
    if (!validatePostalCode(addressData.codigo_postal)) {
      return res.status(400).json({
        error: 'Invalid postal code',
        message: 'Código postal no válido. Solo se permiten códigos postales de Montreal y Rivera Sur'
      });
    }

    console.log('🏠 Creando dirección para usuario:', userId);

    // Verificar si el usuario ya tiene direcciones
    const { data: existingAddresses, error: countError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('id')
      .eq('usuario_id', userId);

    if (countError) {
      console.error('❌ Error al verificar direcciones existentes:', countError);
      throw countError;
    }

    const isFirstAddress = !existingAddresses || existingAddresses.length === 0;

    const { data: newAddress, error } = await supabaseAdmin
      .from('direcciones_envio')
      .insert([{
        usuario_id: userId,
        direccion: addressData.direccion.trim(),
        ciudad: addressData.ciudad.trim(),
        estado: addressData.estado.trim(),
        codigo_postal: addressData.codigo_postal.trim(),
        pais: addressData.pais.trim()
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear dirección:', error);
      
      // Manejar errores específicos de la base de datos
      if (error.code === '23503') {
        return res.status(400).json({
          error: 'Invalid user',
          message: 'User does not exist'
        });
      }
      
      throw error;
    }

    console.log('✅ Dirección creada exitosamente:', newAddress.id);

    // Si es la primera dirección, establecerla automáticamente como principal
    if (isFirstAddress) {
      console.log('🏠 Estableciendo primera dirección como principal:', newAddress.id);
      
      const { error: setPrimaryError } = await supabaseAdmin
        .from('usuarios')
        .update({ direccion_principal_id: newAddress.id })
        .eq('id', userId);

      if (setPrimaryError) {
        console.error('❌ Error al establecer dirección principal:', setPrimaryError);
        // No fallar la creación si no se puede establecer como principal
      } else {
        console.log('✅ Primera dirección establecida como principal');
      }
    }

    // Formatear respuesta
    const formattedAddress = {
      id: newAddress.id,
      // Campos de la base de datos
      direccion: newAddress.direccion,
      ciudad: newAddress.ciudad,
      estado: newAddress.estado,
      codigo_postal: newAddress.codigo_postal,
      pais: newAddress.pais,
      
      // Campos alternativos para compatibilidad
      address: newAddress.direccion,
      city: newAddress.ciudad,
      state: newAddress.estado,
      postalCode: newAddress.codigo_postal,
      country: newAddress.pais,
      isPrimary: isFirstAddress // Si es la primera dirección, es principal
    };

    res.status(201).json({
      message: 'Address created successfully',
      address: formattedAddress
    });
  } catch (error) {
    console.error('❌ Create address error:', error);
    res.status(500).json({
      error: 'Failed to create address',
      message: error.message
    });
  }
};

// === ACTUALIZAR DIRECCIÓN ===
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;
    
    // Extraer campos de ambos formatos
    const {
      // Campos de la base de datos
      direccion,
      ciudad,
      estado,
      codigo_postal,
      pais,
      // Campos alternativos del frontend
      address,
      city,
      state,
      postalCode,
      country,
    } = req.body;

    // Verificar que la dirección existe y pertenece al usuario
    const { data: existingAddress, error: checkError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('id')
      .eq('id', addressId)
      .eq('usuario_id', userId)
      .single();

    if (checkError || !existingAddress) {
      return res.status(404).json({
        error: 'Address not found',
        message: 'Address not found or does not belong to user'
      });
    }

    // Mapear campos del frontend a la base de datos
    const addressData = {
      direccion: direccion || address,
      ciudad: ciudad || city,
      estado: estado || state,
      codigo_postal: codigo_postal || postalCode,
      pais: pais || country
    };

    // Validar campos requeridos
    if (!addressData.direccion || !addressData.ciudad || !addressData.estado || !addressData.codigo_postal || !addressData.pais) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'direccion, ciudad, estado, codigo_postal, and pais are required'
      });
    }

    // Validar que el país sea Canadá y la provincia sea Quebec
    if (addressData.pais.toLowerCase() !== 'canada' && addressData.pais.toLowerCase() !== 'canadá') {
      return res.status(400).json({
        error: 'Invalid country',
        message: 'Solo se permiten direcciones en Canadá'
      });
    }

    if (addressData.estado.toLowerCase() !== 'quebec' && addressData.estado.toLowerCase() !== 'québec') {
      return res.status(400).json({
        error: 'Invalid province',
        message: 'Solo se permiten direcciones en la provincia de Quebec'
      });
    }

    // Validar código postal
    if (!validatePostalCode(addressData.codigo_postal)) {
      return res.status(400).json({
        error: 'Invalid postal code',
        message: 'Código postal no válido. Solo se permiten códigos postales de Montreal y Rivera Sur'
      });
    }

    console.log('🏠 Actualizando dirección:', addressId, 'para usuario:', userId);

    const { data: updatedAddress, error } = await supabaseAdmin
      .from('direcciones_envio')
      .update({
        direccion: addressData.direccion.trim(),
        ciudad: addressData.ciudad.trim(),
        estado: addressData.estado.trim(),
        codigo_postal: addressData.codigo_postal.trim(),
        pais: addressData.pais.trim()
      })
      .eq('id', addressId)
      .eq('usuario_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al actualizar dirección:', error);
      throw error;
    }

    console.log('✅ Dirección actualizada exitosamente:', addressId);

    // Formatear respuesta
    const formattedAddress = {
      id: updatedAddress.id,
      // Campos de la base de datos
      direccion: updatedAddress.direccion,
      ciudad: updatedAddress.ciudad,
      estado: updatedAddress.estado,
      codigo_postal: updatedAddress.codigo_postal,
      pais: updatedAddress.pais,
      // Campos alternativos para compatibilidad
      address: updatedAddress.direccion,
      city: updatedAddress.ciudad,
      state: updatedAddress.estado,
      postalCode: updatedAddress.codigo_postal,
      country: updatedAddress.pais
    };

    res.json({
      message: 'Address updated successfully',
      address: formattedAddress
    });
  } catch (error) {
    console.error('❌ Update address error:', error);
    res.status(500).json({
      error: 'Failed to update address',
      message: error.message
    });
  }
};

// === ELIMINAR DIRECCIÓN ===
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    console.log('🏠 Eliminando dirección:', addressId, 'para usuario:', userId);

    // Verificar que la dirección existe y pertenece al usuario antes de eliminar
    const { data: existingAddress, error: checkError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('id, direccion')
      .eq('id', addressId)
      .eq('usuario_id', userId)
      .single();

    if (checkError || !existingAddress) {
      return res.status(404).json({
        error: 'Address not found',
        message: 'Address not found or does not belong to user'
      });
    }

    // Verificar si la dirección está siendo usada en pedidos
    const { data: ordersUsingAddress, error: ordersError } = await supabaseAdmin
      .from('pedidos')
      .select('id')
      .eq('direccion_envio_id', addressId);

    if (ordersError) {
      console.error('❌ Error al verificar pedidos con esta dirección:', ordersError);
      throw ordersError;
    }

    // Si hay pedidos usando esta dirección, no permitir la eliminación
    if (ordersUsingAddress && ordersUsingAddress.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete address',
        message: 'Esta dirección no puede ser eliminada porque está asociada a pedidos existentes. Para mantener la integridad de los registros de pedidos, las direcciones no pueden eliminarse una vez que han sido utilizadas.'
      });
    }

    // Verificar si es la dirección principal del usuario
    const { data: userInfo, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('direccion_principal_id')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error al verificar dirección principal:', userError);
    }

    const isPrimaryAddress = userInfo?.direccion_principal_id === addressId;

    // Si es la dirección principal, quitarla como principal antes de eliminar
    if (isPrimaryAddress) {
      console.log('🏠 Removiendo dirección principal antes de eliminar');
      const { error: removePrimaryError } = await supabaseAdmin
        .from('usuarios')
        .update({ direccion_principal_id: null })
        .eq('id', userId);

      if (removePrimaryError) {
        console.error('❌ Error al remover dirección principal:', removePrimaryError);
        // No fallar aquí, continuar con la eliminación
      }
    }

    // Eliminar la dirección
    const { error } = await supabaseAdmin
      .from('direcciones_envio')
      .delete()
      .eq('id', addressId)
      .eq('usuario_id', userId);

    if (error) {
      console.error('❌ Error al eliminar dirección:', error);
      
      // Manejar error específico de foreign key constraint
      if (error.code === '23503') {
        return res.status(400).json({
          error: 'Cannot delete address',
          message: 'Esta dirección no puede ser eliminada porque está siendo referenciada por otros registros en el sistema.'
        });
      }
      
      throw error;
    }

    console.log('✅ Dirección eliminada exitosamente:', addressId);

    res.json({
      message: 'Address deleted successfully',
      deletedAddress: {
        id: addressId,
        direccion: existingAddress.direccion
      }
    });
  } catch (error) {
    console.error('❌ Delete address error:', error);
    res.status(500).json({
      error: 'Failed to delete address',
      message: error.message
    });
  }
};

export {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress
};
