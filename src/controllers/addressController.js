import { supabaseAdmin } from '../config/supabase.js';

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

    console.log('🏠 Creando dirección para usuario:', userId);

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
      country: newAddress.pais
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

    // Eliminar la dirección
    const { error } = await supabaseAdmin
      .from('direcciones_envio')
      .delete()
      .eq('id', addressId)
      .eq('usuario_id', userId);

    if (error) {
      console.error('❌ Error al eliminar dirección:', error);
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
