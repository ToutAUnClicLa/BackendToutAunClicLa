# 🛒 API de Carrito de Compras

Sistema completo de carrito de compras con paginación, validación de stock, cálculo de impuestos (TPS/TVQ), soporte para cupones de descuento y opciones de entrega personalizables.

## Base URL
```
https://backendtoutaunclicla-production.up.railway.app/api/v1/cart
```

**🔒 Autenticación Requerida**: Todos los endpoints requieren token JWT válido en el header `Authorization: Bearer <token>`.

---

## Endpoints Disponibles

### 1. Obtener Carrito
**GET** `/`

#### Descripción
Obtiene el carrito del usuario autenticado con paginación y cálculos de impuestos.

#### Headers
```
Authorization: Bearer <jwt_token>
```

#### Query Parameters
| Parámetro | Tipo | Descripción | Requerido | Default |
|-----------|------|-------------|-----------|---------|
| `page` | integer | Número de página | No | 1 |
| `limit` | integer | Items por página | No | 20 |

#### Respuesta Exitosa (200)
```json
{
  "cartItems": [
    {
      "id": "uuid",
      "usuario_id": "uuid",
      "producto_id": 123,
      "cantidad": 2,
      "productos": {
        "id": 123,
        "nombre": "Smartphone Samsung Galaxy",
        "descripcion": "Teléfono inteligente con pantalla AMOLED",
        "precio": 599.99,
        "categoria_id": 1,
        "subcategoria_id": 5,
        "imagen_principal": "https://ejemplo.com/samsung.jpg",
        "stock": 15,
        "provedor": "Samsung Electronics",
        "TPS": 30.00,
        "TVQ": 59.97,
        "categorias": {
          "id": 1,
          "nombre": "Electrónicos"
        },
        "subcategorias": {
          "id": 5,
          "nombre": "Smartphones",
          "Imagen": "https://ejemplo.com/smartphones.jpg",
          "Descripcion": "Teléfonos inteligentes"
        },
        "averageRating": 4.5,
        "reviewCount": 128
      }
    }
  ],
  "total": 1289.95,
  "itemCount": 1,
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "itemsPerPage": 20,
    "hasNextPage": false,
    "hasPrevPage": true
  },
  "summary": {
    "totalItems": 1,
    "totalQuantity": 2,
    "subtotal": 1199.98,
    "totalTPS": 30.00,
    "totalTVQ": 59.97,
    "totalTaxes": 89.97,
    "total": 1289.95
  }
}
```

#### Características
- ✅ Paginación automática con navegación
- ✅ Cálculo automático de impuestos TPS y TVQ
- ✅ Información completa del producto con categorías
- ✅ Calificaciones promedio y conteo de reseñas
- ✅ Resumen detallado con subtotales e impuestos
- ✅ Solo imagen principal (sin secundarias/terciarias)

#### Errores Posibles
| Código | Error | Descripción |
|--------|-------|-------------|
| 401 | Unauthorized | Token inválido o expirado |
| 500 | Internal Server Error | Error del servidor |

---

### 2. Obtener Carrito con Cupón
**GET** `/with-coupon`

#### Descripción
Obtiene el carrito aplicando un cupón de descuento para calcular el precio final con descuentos e impuestos.

#### Headers
```
Authorization: Bearer <jwt_token>
```

#### Request Body
```json
{
  "couponCode": "DESCUENTO20"
}
```

#### Respuesta Exitosa (200)
```json
{
  "cartItems": [
    {
      "id": "uuid",
      "usuario_id": "uuid", 
      "producto_id": 123,
      "cantidad": 2,
      "productos": {
        "id": 123,
        "nombre": "Smartphone Samsung Galaxy",
        "precio": 599.99,
        "stock": 15,
        "averageRating": 4.5,
        "reviewCount": 128
      }
    }
  ],
  "subtotal": 1199.98,
  "discountAmount": 240.00,
  "total": 1049.95,
  "itemCount": 1,
  "appliedCoupon": {
    "id": 1,
    "code": "DESCUENTO20",
    "discount": 20
  },
  "summary": {
    "totalItems": 1,
    "totalQuantity": 2,
    "subtotal": 1199.98,
    "totalTPS": 30.00,
    "totalTVQ": 59.97,
    "totalTaxes": 89.97,
    "total": 1049.95,
    "discount": 240.00,
    "savings": 240.00
  }
}
```

#### Características
- ✅ Aplicación automática de cupón si es válido
- ✅ Cálculo de descuentos sobre subtotal (antes de impuestos)
- ✅ Información del cupón aplicado
- ✅ Total final con descuentos e impuestos

#### Errores Posibles
| Código | Error | Descripción |
|--------|-------|-------------|
| 400 | Invalid coupon | Cupón no encontrado o inválido |
| 400 | Coupon expired | Cupón expirado |
| 401 | Unauthorized | Token inválido |

---

### 3. Agregar Producto al Carrito
**POST** `/items`

#### Descripción
Agrega un producto al carrito o actualiza la cantidad si ya existe. Valida stock disponible antes de agregar.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "productId": 123,
  "quantity": 2
}
```

#### Validaciones del Schema
- **productId**: Número entero positivo, requerido
- **quantity**: Número entero mínimo 1, requerido

#### Respuesta Exitosa (201) - Producto Nuevo
```json
{
  "message": "Item added to cart successfully",
  "cartItem": {
    "id": "uuid",
    "usuario_id": "uuid",
    "producto_id": 123,
    "cantidad": 2
  }
}
```

#### Respuesta Exitosa (200) - Producto Existente Actualizado
```json
{
  "message": "Cart updated successfully",
  "cartItem": {
    "id": "uuid",
    "usuario_id": "uuid", 
    "producto_id": 123,
    "cantidad": 5
  }
}
```

#### Características
- ✅ Validación automática de stock disponible
- ✅ Actualización inteligente si el producto ya existe
- ✅ Restricción de cantidad máxima según stock
- ✅ Validación de que el producto existe

#### Errores Posibles
| Código | Error | Descripción | Ejemplo |
|--------|-------|-------------|---------|
| 400 | Validation error | Datos de entrada inválidos | `productId` no es número |
| 404 | Product not found | Producto no encontrado | ID inexistente |
| 400 | Insufficient stock | Stock insuficiente | Solo 3 disponibles, solicitaste 5 |
| 401 | Unauthorized | Token inválido | Token expirado |

#### Ejemplo de Error (Stock insuficiente)
```json
{
  "error": "Insufficient stock",
  "message": "Only 3 items available"
}
```

---

### 4. Actualizar Cantidad de Producto
**PUT** `/items/:id`

#### Descripción
Actualiza la cantidad de un producto específico en el carrito. Valida stock disponible antes de actualizar.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### URL Parameters
- **id**: ID del item en el carrito (UUID) - Requerido

#### Request Body
```json
{
  "quantity": 3
}
```

#### Validaciones
- **quantity**: Número entero mínimo 1, requerido
- El item debe pertenecer al usuario autenticado
- El producto debe tener stock suficiente

#### Respuesta Exitosa (200)
```json
{
  "message": "Cart item updated successfully",
  "cartItem": {
    "id": "uuid",
    "usuario_id": "uuid",
    "producto_id": 123,
    "cantidad": 3
  }
}
```

#### Características
- ✅ Validación de propiedad del item (solo el usuario puede actualizar sus items)
- ✅ Verificación de stock en tiempo real
- ✅ Actualización atómica de cantidad

#### Errores Posibles
| Código | Error | Descripción |
|--------|-------|-------------|
| 400 | Validation error | Cantidad inválida (debe ser ≥ 1) |
| 400 | Insufficient stock | Stock insuficiente para la cantidad solicitada |
| 404 | Cart item not found | Item no encontrado en el carrito del usuario |
| 401 | Unauthorized | Token inválido |

#### Ejemplo de Error (Item no encontrado)
```json
{
  "error": "Cart item not found",
  "message": "The requested cart item does not exist"
}
```

---

### 5. Eliminar Producto del Carrito
**DELETE** `/items/:id`

#### Descripción
Elimina un producto específico del carrito del usuario autenticado.

#### Headers
```
Authorization: Bearer <jwt_token>
```

#### URL Parameters
- **id**: ID del item en el carrito (UUID) - Requerido

#### Respuesta Exitosa (200)
```json
{
  "message": "Item removed from cart successfully"
}
```

#### Características
- ✅ Eliminación segura (solo el propietario puede eliminar)
- ✅ Operación idempotente (no falla si el item ya no existe)

#### Errores Posibles
| Código | Error | Descripción |
|--------|-------|-------------|
| 404 | Cart item not found | Item no encontrado en el carrito |
| 401 | Unauthorized | Token inválido |

---

### 6. Vaciar Carrito Completo
**DELETE** `/`

#### Descripción
Elimina todos los productos del carrito del usuario autenticado.

#### Headers
```
Authorization: Bearer <jwt_token>
```

#### Respuesta Exitosa (200)
```json
{
  "message": "Cart cleared successfully"
}
```

#### Características
- ✅ Eliminación masiva de todos los items del usuario
- ✅ Operación atómica (todo o nada)
- ✅ Operación idempotente (no falla si el carrito ya está vacío)

#### Errores Posibles
| Código | Error | Descripción |
|--------|-------|-------------|
| 401 | Unauthorized | Token inválido |
| 500 | Internal Server Error | Error del servidor |

---

### 7. Configurar Opciones de Entrega
**PUT** `/delivery-options`

#### Descripción
Configura las opciones de entrega para todo el carrito. Estas opciones se aplican a una sola entrega que incluye todos los items del carrito.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "horaEntregaPreferida": "19:00",
  "metodoEntrega": "puerta",
  "notasEntrega": "Tocar el timbre dos veces - Apartamento 3B",
  "aplicarATodos": true
}
```

#### Validaciones del Schema
- **horaEntregaPreferida**: String en formato HH:MM, entre 12:00 y 22:00, por defecto "18:00"
- **metodoEntrega**: String, valores válidos: "puerta", "manos", "recepcion", por defecto "puerta"
- **notasEntrega**: String opcional, máximo 500 caracteres
- **aplicarATodos**: Boolean, por defecto true (recomendado para una sola entrega)

#### Respuesta Exitosa (200)
```json
{
  "message": "Delivery options updated for entire cart",
  "updatedItems": 3,
  "deliveryOptions": {
    "horaEntregaPreferida": "19:00",
    "metodoEntrega": "puerta",
    "notasEntrega": "Tocar el timbre dos veces - Apartamento 3B"
  }
}
```

#### Características
- ✅ Configuración para una sola entrega (todos los items juntos)
- ✅ Validación de horarios de entrega (12:00 PM - 10:00 PM)
- ✅ Métodos de entrega: puerta, manos, recepción
- ✅ Notas personalizadas para el repartidor
- ✅ Aplicación automática a todo el carrito por defecto

#### Errores Posibles
| Código | Error | Descripción | Ejemplo |
|--------|-------|-------------|---------|
| 400 | Validation error | Datos de entrada inválidos | Hora fuera del rango 12:00-22:00 |
| 400 | Invalid delivery time | Hora de entrega inválida | "11:00" o "23:30" |
| 400 | Invalid delivery method | Método de entrega inválido | "helicoptero" |
| 401 | Unauthorized | Token inválido | Token expirado |

#### Métodos de Entrega Disponibles
| Valor | Descripción |
|-------|-------------|
| `puerta` | Dejar el pedido en la puerta |
| `manos` | Entregar directamente en mano |
| `recepcion` | Dejar en recepción/portería |

---

### 8. Aplicar Cupón de Descuento 🚨 Rate Limited
**POST** `/apply-coupon`

#### Descripción
Aplica un cupón de descuento al carrito y devuelve el resumen con el descuento calculado.

#### Rate Limiting
- **Límite**: 10 intentos por 10 minutos por usuario
- **Reset**: Automático cada 10 minutos
- **Header de respuesta**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "couponCode": "DESCUENTO20"
}
```

#### Validaciones del Schema
- **couponCode**: String de 3-20 caracteres, requerido

#### Respuesta Exitosa (200)
```json
{
  "message": "Coupon applied successfully",
  "coupon": {
    "id": 1,
    "code": "DESCUENTO20",
    "discount": 20
  },
  "cartSummary": {
    "subtotal": 1199.98,
    "discountAmount": 240.00,
    "total": 959.98,
    "itemCount": 2
  }
}
```

#### Características
- ✅ Validación de existencia y vigencia del cupón
- ✅ Verificación de fecha de expiración
- ✅ Aplicación de descuento sobre subtotal (antes de impuestos)
- ✅ Rate limiting para prevenir abuso

#### Errores Posibles
| Código | Error | Descripción | Ejemplo |
|--------|-------|-------------|---------|
| 400 | Empty cart | Carrito vacío | No se puede aplicar cupón a carrito vacío |
| 404 | Invalid coupon | Cupón no encontrado | Código "INVALID20" no existe |
| 400 | Coupon expired | Cupón expirado | Expiró el 15/06/2025 |
| 429 | Too Many Requests | Rate limit excedido | Máximo 10 intentos por 10 min |
| 401 | Unauthorized | Token inválido | Token expirado |

#### Ejemplo de Error (Cupón expirado)
```json
{
  "error": "Coupon expired",
  "message": "This coupon has expired"
}
```

#### Ejemplo de Error (Rate Limit)
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 10 minutes."
}
```

---

## 📋 Casos de Uso Comunes

### Flujo Completo de Carrito de Compras

#### 1. Agregar Productos al Carrito
```bash
# Agregar primer producto
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 123,
    "quantity": 2
  }'

# Agregar segundo producto  
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 456,
    "quantity": 1
  }'
```

#### 2. Consultar Estado del Carrito
```bash
# Ver carrito con paginación
curl -X GET "https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

#### 3. Aplicar Cupón de Descuento
```bash
# Aplicar cupón
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/apply-coupon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "DESCUENTO20"
  }'
```

#### 4. Ver Carrito con Descuento Aplicado
```bash
# Ver carrito con cupón aplicado
curl -X GET https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/with-coupon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "DESCUENTO20"
  }'
```

#### 5. Modificar Cantidades
```bash
# Actualizar cantidad de un producto
curl -X PUT https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/items/<item_uuid> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3
  }'
```

#### 6. Configurar Opciones de Entrega (Pre-Checkout)
```bash
# Configurar entrega para todo el carrito antes del checkout
curl -X PUT https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/delivery-options \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "horaEntregaPreferida": "19:30",
    "metodoEntrega": "manos",
    "notasEntrega": "Llamar al llegar - Apartamento 2B, segundo piso"
  }'
```

#### 7. Eliminar Productos
```bash
# Eliminar producto específico
curl -X DELETE https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/items/<item_uuid> \
  -H "Authorization: Bearer <token>"

# Vaciar carrito completo
curl -X DELETE https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/ \
  -H "Authorization: Bearer <token>"
```

---

## 🔧 Reglas de Negocio

### Opciones de Entrega
- ✅ **Una sola entrega**: Todos los items del carrito se entregan juntos
- ✅ **Horarios controlados**: Entregas entre 12:00 PM y 10:00 PM
- ✅ **Métodos flexibles**: Entrega en puerta, manos o recepción
- ✅ **Notas personalizadas**: Instrucciones específicas para el repartidor
- ✅ **Configuración pre-checkout**: Las opciones se configuran antes de proceder al pago

### Gestión de Stock
- ✅ **Validación en tiempo real**: Se verifica stock disponible antes de agregar/actualizar
- ✅ **Protección contra sobreventa**: No se pueden agregar más productos de los disponibles  
- ✅ **Stock dinámico**: El stock se consulta en cada operación para evitar inconsistencias

### Sistema de Cupones
- ✅ **Cupón único por carrito**: Un usuario puede aplicar un cupón por sesión de carrito
- ✅ **Validación de vigencia**: Los cupones tienen fecha de expiración obligatoria
- ✅ **Descuento sobre subtotal**: Los descuentos se aplican antes del cálculo de impuestos
- ✅ **Tipos de descuento**: Soporte para descuentos por porcentaje

### Cálculo de Impuestos (Canadá - Quebec)
- ✅ **TPS (Taxe sur les produits et services)**: Impuesto federal aplicado por producto
- ✅ **TVQ (Taxe de vente du Québec)**: Impuesto provincial aplicado por producto  
- ✅ **Cálculo automático**: Los impuestos se calculan automáticamente en cada consulta
- ✅ **Transparencia**: Se muestran impuestos desglosados en el resumen

### Persistencia y Seguridad
- ✅ **Carrito persistente**: El carrito persiste entre sesiones del usuario
- ✅ **Aislamiento por usuario**: Cada usuario solo puede acceder a su propio carrito
- ✅ **Validación de propiedad**: Todas las operaciones validan que el item pertenezca al usuario
- ✅ **Paginación eficiente**: Soporte para carritos grandes con paginación

### Límites y Restricciones
- ✅ **Límite de paginación**: Máximo 20 items por página (configurable)
- ✅ **Validación de cantidad**: Cantidad mínima de 1 por producto
- ✅ **Rate limiting**: Protección contra abuso en aplicación de cupones (10 intentos/10min)

---

## 📊 Estructura de Datos

### Esquema de Base de Datos

#### Tabla `carrito`
```sql
create table public.carrito (
  id uuid not null default gen_random_uuid(),
  usuario_id uuid not null,
  producto_id bigint not null,
  cantidad integer not null,
  constraint carrito_pkey primary key (id),
  constraint carrito_unico unique (usuario_id, producto_id),
  constraint carrito_producto_id_fkey foreign key (producto_id) references productos (id) on delete cascade,
  constraint carrito_cantidad_check check ((cantidad > 0))
);
```

#### Tabla `productos` (campos relevantes)
```sql
create table public.productos (
  id bigint generated always as identity not null,
  nombre text not null,
  descripcion text null,
  precio numeric(10, 2) not null,
  categoria_id bigint null,
  stock integer null default 0,
  imagen_principal text null,
  subcategoria_id bigint null,
  provedor text null,
  "TPS" smallint null,
  "TVQ" numeric null,
  -- campos secundarios y terciarios excluidos del carrito
  constraint productos_pkey primary key (id)
);
```

### Cálculos Automáticos

#### Fórmulas de Totales
```javascript
// Subtotal (antes de impuestos y descuentos)
subtotal = Σ(producto.precio × cantidad)

// Impuestos por producto
totalTPS = Σ(producto.TPS × cantidad)
totalTVQ = Σ(producto.TVQ × cantidad)
totalTaxes = totalTPS + totalTVQ

// Descuento (aplicado sobre subtotal)
discountAmount = (subtotal × cupón.descuento) / 100

// Total final
total = subtotal + totalTaxes - discountAmount
```

---

## ⚠️ Notas Importantes

### Para Desarrolladores
- 🔑 **Autenticación obligatoria**: Todos los endpoints requieren JWT válido
- 📄 **Paginación recomendada**: Para carritos grandes, usar siempre paginación
- 🔒 **Validación de propiedad**: El sistema valida automáticamente que el usuario solo acceda a sus items
- 💰 **Precisión de cálculos**: Usar tipos `numeric` para evitar errores de redondeo en precios

### Para Testing
- 🧪 **Datos de prueba**: Crear productos con diferentes configuraciones de TPS/TVQ
- 🎟️ **Cupones de prueba**: Crear cupones con diferentes porcentajes y fechas de expiración
- 🔄 **Rate limiting**: Considerar límites al probar aplicación de cupones
- 📊 **Scenarios de stock**: Probar casos con stock limitado y agotado

### Para Producción
- 📈 **Monitoring**: Monitorear uso de cupones y patrones de carritos abandonados
- 🔐 **Seguridad**: Los tokens JWT deben tener expiración apropiada
- 💾 **Backup**: Considerar backup de carritos antes de limpiezas automáticas
- 🚀 **Performance**: Considerar índices en `usuario_id` y `producto_id` para consultas frecuentes
