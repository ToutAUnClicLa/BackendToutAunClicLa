# 🎫 Sistema de Cupones Únicos por UUID - Implementación

## 📋 Requerimientos
1. **Cupones únicos** asignados a usuarios específicos por UUID
2. **Límite de uso** por usuario
3. **Envío gratis** cuando `descuento = 0`
4. **Control granular** de quién puede usar cada cupón

---

## 🔧 Modificaciones a la Base de Datos

### **Agregar Campo `usuario_asignado` a la Tabla `cupones`**

```sql
-- Agregar columna para cupones únicos por UUID
ALTER TABLE public.cupones 
ADD COLUMN usuario_asignado UUID REFERENCES usuarios(id);

-- Agregar columna de descripción para mejor gestión
ALTER TABLE public.cupones 
ADD COLUMN descripcion TEXT;

-- Agregar índice para optimizar búsquedas
CREATE INDEX idx_cupones_usuario_asignado ON cupones(usuario_asignado);
CREATE INDEX idx_cupones_activo_codigo ON cupones(activo, codigo);
```

### **Estructura Final de la Tabla `cupones`**

```sql
create table public.cupones (
  id bigint generated always as identity not null,
  codigo text not null unique,
  descuento numeric not null,
  fecha_expiracion date,
  limite_usos integer, -- Límite por usuario (NULL = ilimitado)
  activo boolean default true,
  usuario_asignado UUID REFERENCES usuarios(id), -- ✨ NUEVO - Cupón único para usuario
  descripcion TEXT, -- ✨ NUEVO - Descripción del cupón
  constraint cupones_pkey primary key (id)
);
```

---

## 🚀 API para Gestión de Cupones Únicos

### **Endpoint: Crear Cupón Único**
```javascript
// POST /api/v1/admin/cupones/create-unique
{
  "codigo": "REGALO-JUAN-2025",
  "descuento": 0, // 0 = envío gratis, >0 = descuento porcentual
  "fecha_expiracion": "2025-12-31",
  "limite_usos": 1,
  "usuario_asignado": "b78a5fc6-76b3-47d3-bfe2-a1af45ddcba2",
  "descripcion": "Cupón regalo para Juan - envío gratis"
}
```

### **Endpoint: Crear Múltiples Cupones Únicos**
```javascript
// POST /api/v1/admin/cupones/create-batch
{
  "cupones": [
    {
      "codigo": "REGALO-MARIA-2025",
      "descuento": 15,
      "usuario_asignado": "uuid-maria",
      "limite_usos": 3,
      "descripcion": "Cupón regalo María - 15% descuento"
    },
    {
      "codigo": "ENVIO-CARLOS-2025", 
      "descuento": 0,
      "usuario_asignado": "uuid-carlos",
      "limite_usos": 1,
      "descripcion": "Cupón envío gratis Carlos"
    }
  ]
}
```

---

## 🔍 Lógica de Validación Actualizada

### **Nueva Función `validateCoupon` con Soporte UUID**

```javascript
// src/utils/cartHelpers.js - FUNCIÓN ACTUALIZADA
export const validateCoupon = async (couponCode, userId) => {
  if (!couponCode || typeof couponCode !== 'string') {
    return { valid: false, error: 'Código de cupón inválido' };
  }

  // Buscar cupón
  const { data: coupons } = await supabaseAdmin
    .from('cupones')
    .select('*')
    .ilike('codigo', couponCode.toUpperCase().trim());
  
  const coupon = coupons?.[0];
  if (!coupon) {
    return { valid: false, error: 'Cupón no encontrado' };
  }

  // Validar estado del cupón
  if (coupon.activo === false) {
    return { valid: false, error: 'Cupón inactivo' };
  }

  if (coupon.fecha_expiracion && new Date(coupon.fecha_expiracion) < new Date()) {
    return { valid: false, error: 'Cupón expirado' };
  }

  // ✨ NUEVA VALIDACIÓN - Cupón único por UUID
  if (coupon.usuario_asignado) {
    if (coupon.usuario_asignado !== userId) {
      return { 
        valid: false, 
        error: 'Este cupón no está asignado a tu cuenta' 
      };
    }
  }
  // Si no tiene usuario_asignado, es un cupón público (comportamiento anterior)

  // Validar límite de usos
  if (coupon.limite_usos !== null) {
    const { data: userUsages, error: usageError } = await supabaseAdmin
      .from('cupones_usos')
      .select('id')
      .eq('cupon_id', coupon.id)
      .eq('usuario_id', userId);

    if (usageError) {
      return { valid: false, error: 'Error verificando uso del cupón' };
    }

    const userUsageCount = userUsages?.length || 0;
    if (userUsageCount >= coupon.limite_usos) {
      return { 
        valid: false, 
        error: `Has alcanzado el límite de uso para este cupón (${coupon.limite_usos} veces)` 
      };
    }
  }

  return { valid: true, coupon };
};
```

---

## 🎯 Controlador Admin para Gestión de Cupones

### **Crear Archivo: `src/controllers/couponAdminController.js`**

```javascript
import { supabaseAdmin } from '../config/supabase.js';

// Crear cupón único
export const createUniqueCoupon = async (req, res) => {
  try {
    const {
      codigo,
      descuento,
      fecha_expiracion,
      limite_usos = 1,
      usuario_asignado,
      descripcion
    } = req.body;

    // Validar usuario existe
    const { data: user } = await supabaseAdmin
      .from('usuarios')
      .select('id, correo_electronico, nombre')
      .eq('id', usuario_asignado)
      .single();

    if (!user) {
      return res.status(400).json({
        error: 'Usuario no encontrado',
        message: 'El UUID del usuario no existe'
      });
    }

    // Crear cupón
    const { data: coupon, error } = await supabaseAdmin
      .from('cupones')
      .insert({
        codigo: codigo.toUpperCase().trim(),
        descuento: parseFloat(descuento),
        fecha_expiracion,
        limite_usos,
        usuario_asignado,
        descripcion,
        activo: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Código duplicado
        return res.status(400).json({
          error: 'Código duplicado',
          message: 'Ya existe un cupón con este código'
        });
      }
      throw error;
    }

    console.log('✅ Cupón único creado:', {
      codigo: coupon.codigo,
      usuario: user.correo_electronico,
      tipo: descuento === 0 ? 'Envío gratis' : `${descuento}% descuento`
    });

    res.json({
      success: true,
      coupon: {
        ...coupon,
        usuario_info: {
          correo: user.correo_electronico,
          nombre: user.nombre
        }
      },
      message: `Cupón ${coupon.codigo} creado para ${user.correo_electronico}`
    });

  } catch (error) {
    console.error('❌ Error creando cupón único:', error);
    res.status(500).json({
      error: 'Failed to create coupon',
      message: error.message
    });
  }
};

// Crear múltiples cupones únicos
export const createBatchUniqueCoupons = async (req, res) => {
  try {
    const { cupones } = req.body;
    
    if (!Array.isArray(cupones) || cupones.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Se requiere un array de cupones'
      });
    }

    const results = [];
    const errors = [];

    for (const cuponData of cupones) {
      try {
        const {
          codigo,
          descuento,
          fecha_expiracion,
          limite_usos = 1,
          usuario_asignado,
          descripcion
        } = cuponData;

        // Validar usuario existe
        const { data: user } = await supabaseAdmin
          .from('usuarios')
          .select('id, correo_electronico, nombre')
          .eq('id', usuario_asignado)
          .single();

        if (!user) {
          errors.push({
            codigo,
            error: `Usuario ${usuario_asignado} no encontrado`
          });
          continue;
        }

        // Crear cupón
        const { data: coupon, error } = await supabaseAdmin
          .from('cupones')
          .insert({
            codigo: codigo.toUpperCase().trim(),
            descuento: parseFloat(descuento),
            fecha_expiracion,
            limite_usos,
            usuario_asignado,
            descripcion,
            activo: true
          })
          .select()
          .single();

        if (error) {
          errors.push({
            codigo,
            error: error.message
          });
        } else {
          results.push({
            ...coupon,
            usuario_info: {
              correo: user.correo_electronico,
              nombre: user.nombre
            }
          });
        }

      } catch (itemError) {
        errors.push({
          codigo: cuponData.codigo,
          error: itemError.message
        });
      }
    }

    console.log('✅ Cupones batch creados:', {
      exitosos: results.length,
      errores: errors.length
    });

    res.json({
      success: true,
      created: results,
      errors: errors,
      summary: {
        total: cupones.length,
        exitosos: results.length,
        errores: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Error creando cupones batch:', error);
    res.status(500).json({
      error: 'Failed to create coupons batch',
      message: error.message
    });
  }
};

// Listar cupones únicos por usuario
export const getCouponsForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: cupones } = await supabaseAdmin
      .from('cupones')
      .select(`
        *,
        cupones_usos!inner(id, fecha_uso)
      `)
      .eq('usuario_asignado', userId)
      .eq('activo', true);

    // Calcular usos restantes
    const cuponesConUsos = cupones?.map(cupon => {
      const usoCount = cupon.cupones_usos?.length || 0;
      const usosRestantes = cupon.limite_usos ? Math.max(0, cupon.limite_usos - usoCount) : 'Ilimitado';
      
      return {
        ...cupon,
        usos_actuales: usoCount,
        usos_restantes: usosRestantes,
        puede_usar: usosRestantes === 'Ilimitado' || usosRestantes > 0,
        cupones_usos: undefined // Ocultar detalles de uso
      };
    }) || [];

    res.json({
      cupones: cuponesConUsos,
      total: cuponesConUsos.length,
      activos: cuponesConUsos.filter(c => c.puede_usar).length
    });

  } catch (error) {
    console.error('❌ Error obteniendo cupones del usuario:', error);
    res.status(500).json({
      error: 'Failed to get user coupons',
      message: error.message
    });
  }
};
```

---

## 🛠️ Rutas Admin

### **Crear Archivo: `src/routes/couponAdmin.route.js`**

```javascript
import express from 'express';
import { 
  createUniqueCoupon,
  createBatchUniqueCoupons,
  getCouponsForUser
} from '../controllers/couponAdminController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import Joi from 'joi';

const router = express.Router();

// Schemas de validación
const uniqueCouponSchema = Joi.object({
  codigo: Joi.string().min(3).max(50).required(),
  descuento: Joi.number().min(0).max(100).required(),
  fecha_expiracion: Joi.date().optional(),
  limite_usos: Joi.number().integer().min(1).optional(),
  usuario_asignado: Joi.string().uuid().required(),
  descripcion: Joi.string().max(500).optional()
});

const batchCouponsSchema = Joi.object({
  cupones: Joi.array().items(uniqueCouponSchema).min(1).max(100).required()
});

// Rutas protegidas (solo admin)
router.post('/create-unique', 
  authMiddleware, 
  validateRequest(uniqueCouponSchema), 
  createUniqueCoupon
);

router.post('/create-batch', 
  authMiddleware, 
  validateRequest(batchCouponsSchema), 
  createBatchUniqueCoupons
);

router.get('/user/:userId', 
  authMiddleware, 
  getCouponsForUser
);

export default router;
```

### **Agregar a `src/server.js`:**
```javascript
import couponAdminRoutes from './routes/couponAdmin.route.js';

// Agregar después de las otras rutas
app.use('/api/v1/admin/cupones', couponAdminRoutes);
```

---

## 📊 Ejemplos de Uso

### **1. Crear Cupón de Envío Gratis Único**
```bash
curl -X POST http://localhost:3000/api/v1/admin/cupones/create-unique \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "REGALO-JUAN-2025",
    "descuento": 0,
    "fecha_expiracion": "2025-12-31",
    "limite_usos": 1,
    "usuario_asignado": "b78a5fc6-76b3-47d3-bfe2-a1af45ddcba2",
    "descripcion": "Cupón regalo para Juan - envío gratis"
  }'
```

### **2. Crear Cupón de Descuento Único**
```bash
curl -X POST http://localhost:3000/api/v1/admin/cupones/create-unique \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "DESCUENTO-MARIA-20",
    "descuento": 20,
    "fecha_expiracion": "2025-12-31",
    "limite_usos": 3,
    "usuario_asignado": "uuid-maria",
    "descripcion": "Cupón 20% descuento para María"
  }'
```

### **3. Crear Múltiples Cupones**
```bash
curl -X POST http://localhost:3000/api/v1/admin/cupones/create-batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cupones": [
      {
        "codigo": "NAVIDAD-PEDRO-2025",
        "descuento": 0,
        "usuario_asignado": "uuid-pedro",
        "limite_usos": 1,
        "descripcion": "Cupón Navidad Pedro - envío gratis"
      },
      {
        "codigo": "ANIVERSARIO-ANA-15",
        "descuento": 15,
        "usuario_asignado": "uuid-ana", 
        "limite_usos": 2,
        "descripcion": "Cupón aniversario Ana - 15% descuento"
      }
    ]
  }'
```

---

## 🧪 Testing

### **Casos de Prueba**

1. **✅ Cupón único válido**: Usuario correcto puede usar su cupón
2. **❌ Cupón único inválido**: Usuario incorrecto NO puede usar cupón ajeno  
3. **✅ Envío gratis**: `descuento = 0` aplica envío gratis
4. **✅ Descuento porcentual**: `descuento > 0` aplica descuento al subtotal
5. **✅ Límite de usos**: Respeta límite por usuario
6. **✅ Cupones públicos**: Cupones sin `usuario_asignado` siguen funcionando

### **Datos de Prueba**
```sql
-- Cupón único de envío gratis
INSERT INTO cupones (codigo, descuento, limite_usos, usuario_asignado, descripcion) 
VALUES ('REGALO-TEST-001', 0, 1, 'b78a5fc6-76b3-47d3-bfe2-a1af45ddcba2', 'Test envío gratis');

-- Cupón único de descuento
INSERT INTO cupones (codigo, descuento, limite_usos, usuario_asignado, descripcion)
VALUES ('DESCUENTO-TEST-15', 15, 2, 'b78a5fc6-76b3-47d3-bfe2-a1af45ddcba2', 'Test 15% descuento');

-- Cupón público (sin usuario_asignado)
INSERT INTO cupones (codigo, descuento, limite_usos, descripcion)
VALUES ('PUBLICO-10', 10, 5, 'Cupón público 10% descuento');
```

---

## 🚀 Funcionalidades Implementadas

✅ **Cupones únicos por UUID**: Solo el usuario asignado puede usar el cupón  
✅ **Envío gratis**: `descuento = 0` activa envío gratis  
✅ **Descuentos porcentuales**: `descuento > 0` aplica descuento al subtotal  
✅ **Límites de uso**: Control granular de usos por usuario  
✅ **Compatibilidad**: Cupones públicos sin `usuario_asignado` siguen funcionando  
✅ **API Admin**: Endpoints para crear y gestionar cupones únicos  
✅ **Validación robusta**: Verificación de UUID, límites y permisos  
✅ **Logs detallados**: Seguimiento de creación y uso de cupones  

El sistema mantiene **total compatibilidad** con cupones existentes mientras agrega la funcionalidad de cupones únicos por UUID.