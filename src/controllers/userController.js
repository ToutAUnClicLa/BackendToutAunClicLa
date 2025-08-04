import { supabaseAdmin } from '../config/supabase.js';
import bcrypt from 'bcryptjs';

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, telefono, avatarUrl } = req.body;

    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .update({
        nombre: nombre,
        telefono: telefono,
        url_avatar: avatarUrl
      })
      .eq('id', userId)
      .select('id, correo_electronico, nombre, telefono, verificado, fecha_creacion, url_avatar, direccion_principal_id')
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        createdAt: user.fecha_creacion,
        avatarUrl: user.url_avatar,
        primaryAddressId: user.direccion_principal_id
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Obtener el hash de la contraseña actual del usuario
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Verificar contraseña actual usando bcrypt
    if (user.password_hash) {
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrentPassword) {
        return res.status(400).json({
          error: 'Invalid current password',
          message: 'Current password is incorrect'
        });
      }
    } else {
      return res.status(400).json({
        error: 'Password change not available',
        message: 'Password change is not available for this account type'
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'New password must be different from current password'
      });
    }

    // Hash de la nueva contraseña
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña en nuestra tabla
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ 
        password_hash: hashedNewPassword,
        fecha_cambio_contrasena: new Date().toISOString(),
        requiere_cambio_contrasena: false
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Obtener el hash de la contraseña del usuario desde nuestra tabla
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Verificar contraseña usando bcrypt
    if (user.password_hash) {
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          error: 'Invalid password',
          message: 'Password is incorrect'
        });
      }
    } else {
      return res.status(400).json({
        error: 'Account deletion not available',
        message: 'Account deletion is not available for this account type'
      });
    }

    // Eliminar el usuario de nuestra tabla personalizada
    const { error: deleteTableError } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', userId);

    if (deleteTableError) {
      throw deleteTableError;
    }

    // Intentar eliminar de Supabase Auth si existe (opcional)
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (authDeleteError) {
      // No es crítico si falla, ya que el usuario principal está en nuestra tabla
      console.log('Auth user deletion failed (not critical):', authDeleteError.message);
    }
    
    res.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      message: error.message
    });
  }
};

// Admin functions
const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      verified,
      sortBy = 'fecha_creacion', 
      sortOrder = 'desc' 
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('usuarios')
      .select('id, correo_electronico, nombre, telefono, verificado, fecha_creacion, fecha_ultimo_login, cuenta_bloqueada, url_avatar', { count: 'exact' });

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,correo_electronico.ilike.%${search}%`);
    }

    if (verified !== undefined) {
      query = query.eq('verificado', verified === 'true');
    }

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      throw error;
    }

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.correo_electronico,
      nombre: user.nombre,
      telefono: user.telefono,
      verified: user.verificado,
      isBlocked: user.cuenta_bloqueada,
      lastLogin: user.fecha_ultimo_login,
      createdAt: user.fecha_creacion,
      avatarUrl: user.url_avatar
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      error: 'Failed to get users',
      message: error.message
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked, reason } = req.body;

    // Update user block status
    const updateData = {
      cuenta_bloqueada: blocked
    };

    if (blocked && reason) {
      updateData.razon_bloqueo = reason;
      updateData.fecha_bloqueo = new Date().toISOString();
    } else if (!blocked) {
      updateData.razon_bloqueo = null;
      updateData.fecha_bloqueo = null;
    }

    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select('id, correo_electronico, nombre, telefono, verificado, fecha_creacion, cuenta_bloqueada, razon_bloqueo')
      .single();

    if (error) {
      throw error;
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    res.json({
      message: `User ${blocked ? 'blocked' : 'unblocked'} successfully`,
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        isBlocked: user.cuenta_bloqueada,
        blockReason: user.razon_bloqueo,
        createdAt: user.fecha_creacion
      }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      error: 'Failed to update user status',
      message: error.message
    });
  }
};

// Establecer dirección principal del usuario
const setPrimaryAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.body;

    // Verificar que la dirección existe y pertenece al usuario
    const { data: address, error: addressError } = await supabaseAdmin
      .from('direcciones_envio')
      .select('id')
      .eq('id', addressId)
      .eq('usuario_id', userId)
      .single();

    if (addressError || !address) {
      return res.status(404).json({
        error: 'Address not found',
        message: 'Address not found or does not belong to user'
      });
    }

    // Actualizar la dirección principal del usuario
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .update({
        direccion_principal_id: addressId
      })
      .eq('id', userId)
      .select('id, correo_electronico, nombre, telefono, verificado, fecha_creacion, url_avatar, direccion_principal_id')
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Primary address updated successfully',
      user: {
        id: user.id,
        email: user.correo_electronico,
        nombre: user.nombre,
        telefono: user.telefono,
        verified: user.verificado,
        createdAt: user.fecha_creacion,
        avatarUrl: user.url_avatar,
        primaryAddressId: user.direccion_principal_id
      }
    });
  } catch (error) {
    console.error('Set primary address error:', error);
    res.status(500).json({
      error: 'Failed to set primary address',
      message: error.message
    });
  }
};

export {
  updateProfile,
  changePassword,
  deleteAccount,
  getAllUsers,
  updateUserStatus,
  setPrimaryAddress
};
