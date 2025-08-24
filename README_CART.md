# 🛒 API de Carrito de Compras

Sistema completo de carrito de compras con paginación, validación de stock, cálculo de impuestos (TPS/TVQ), soporte para cupones de descuento (precio y envío gratis) y opciones de entrega personalizables.

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
Obtiene el carrito del usuario autenticado con paginación, cálculo de impuestos y costos de envío.

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
      "hora_entrega_preferida": "18:00",
      "metodo_entrega": "puerta", 
      "notas_entrega": "Apartamento 3B",
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
        "TPS": 5,
        "TVQ": 9.975,
        "consigne": 0.25,
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
  "total": 1318.44,
  "itemCount": 1,
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "itemsPerPage": 20,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "summary": {
    "totalItems": 1,
    "totalQuantity": 2,
    "subtotal": 1199.98,
    "subtotalWithTaxes": 1199.98,
    "subtotalWithConsigne": 1199.98,
    "totalTPS": 59.99,
    "totalTVQ": 119.98,
    "totalConsigne": 0.50,
    "totalTaxes": 180.47,
    "shippingCost": 8.99,
    "shippingThreshold": 200,
    "total": 1318.44
  }
}
```

#### Características
- ✅ Paginación automática con navegación
- ✅ Cálculo automático de impuestos TPS, TVQ y consigne
- ✅ Información completa del producto con categorías
- ✅ Calificaciones promedio y conteo de reseñas
- ✅ Resumen detallado con subtotales, impuestos y envío
- ✅ Costo de envío: $8.99 CAD (gratis para pedidos ≥ $200 CAD)
- ✅ Opciones de entrega por item

---

### 2. Obtener Carrito con Cupón
**GET** `/with-coupon`

#### Descripción
Obtiene el carrito aplicando un cupón de descuento o envío gratis para calcular el precio final.

#### Headers
```
Authorization: Bearer <jwt_token>
```

#### Query Parameters
| Parámetro | Tipo | Descripción | Requerido |
|-----------|------|-------------|-----------|
| `couponCode` | string | Código del cupón a aplicar | Sí |

#### Tipos de Cupones Soportados
1. **Cupones de Descuento**: Aplican % de descuento al total completo (incluye impuestos y envío)
2. **Cupones de Envío Gratis**: Códigos que inician con `ENVIO` o `SHIP` - eliminan el costo de envío

#### Respuesta Exitosa (200) - Cupón de Descuento
```json
{
  "cartItems": [...],
  "subtotal": 1199.98,
  "discountAmount": 263.69,
  "total": 1054.75,
  "itemCount": 1,
  "appliedCoupon": {
    "id": 1,
    "code": "DESCUENTO20",
    "discount": 20,
    "type": "discount",
    "description": "20% de descuento"
  },
  "summary": {
    "totalItems": 1,
    "totalQuantity": 2,
    "subtotal": 1199.98,
    "subtotalWithTaxes": 1199.98,
    "subtotalWithConsigne": 1199.98,
    "totalTPS": 59.99,
    "totalTVQ": 119.98,
    "totalConsigne": 0.50,
    "totalTaxes": 180.47,
    "shippingCost": 8.99,
    "originalShippingCost": 8.99,
    "shippingThreshold": 200,
    "totalBeforeDiscount": 1389.44,
    "total": 1054.75,
    "discount": 263.69,
    "savings": 263.69,
    "freeShippingApplied": false
  }
}
```

#### Respuesta Exitosa (200) - Cupón de Envío Gratis
```json
{
  "cartItems": [...],
  "subtotal": 1199.98,
  "discountAmount": 0,
  "total": 1380.45,
  "itemCount": 1,
  "appliedCoupon": {
    "id": 2,
    "code": "ENVIOGRATIS",
    "discount": 0,
    "type": "free_shipping",
    "description": "Envío gratis"
  },
  "summary": {
    "totalItems": 1,
    "totalQuantity": 2,
    "subtotal": 1199.98,
    "subtotalWithTaxes": 1199.98,
    "subtotalWithConsigne": 1199.98,
    "totalTPS": 59.99,
    "totalTVQ": 119.98,
    "totalConsigne": 0.50,
    "totalTaxes": 180.47,
    "shippingCost": 0.00,
    "originalShippingCost": 8.99,
    "shippingThreshold": 200,
    "totalBeforeDiscount": 1380.45,
    "total": 1380.45,
    "discount": 0,
    "savings": 8.99,
    "freeShippingApplied": true
  }
}
```

#### Características
- ✅ **Cupones de Descuento**: Aplican % sobre total completo (subtotal + impuestos + envío)
- ✅ **Cupones de Envío Gratis**: Códigos con prefijo `ENVIO` o `SHIP` eliminan costo de envío
- ✅ Aplicación automática de cupón si es válido
- ✅ Información detallada del cupón aplicado con tipo y descripción
- ✅ Cálculo de ahorros totales (descuento + envío gratis si aplica)
- ✅ Total final con descuentos, impuestos y envío

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
Agrega un producto al carrito o actualiza la cantidad si ya existe. Incluye opciones de entrega y valida stock disponible.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "productId": 123,
  "quantity": 2,
  "horaEntregaPreferida": "18:00",
  "metodoEntrega": "puerta",
  "notasEntrega": "Apartamento 3B - Tocar timbre"
}
```

#### Validaciones del Schema
- **productId**: Número entero positivo, requerido
- **quantity**: Número entero mínimo 1, requerido
- **horaEntregaPreferida**: String en formato HH:MM, entre 11:00 y 21:00, opcional (default: "18:00")
- **metodoEntrega**: String, valores válidos: "puerta", "manos", "recepcion", opcional (default: "puerta")
- **notasEntrega**: String opcional, máximo 500 caracteres

#### Respuesta Exitosa (201) - Producto Nuevo
```json
{
  "message": "Item added to cart successfully",
  "cartItem": {
    "id": "uuid",
    "usuario_id": "uuid",
    "producto_id": 123,
    "cantidad": 2,
    "hora_entrega_preferida": "18:00",
    "metodo_entrega": "puerta",
    "notas_entrega": "Apartamento 3B - Tocar timbre"
  }
}
```

#### Características
- ✅ Validación automática de stock disponible
- ✅ Actualización inteligente si el producto ya existe
- ✅ Configuración de opciones de entrega por item
- ✅ Validación de horarios de entrega (11:00 AM - 9:00 PM)
- ✅ Restricción de cantidad máxima según stock

#### Errores Posibles
| Código | Error | Descripción | Ejemplo |
|--------|-------|-------------|---------|
| 400 | Validation error | Datos de entrada inválidos | `horaEntregaPreferida` fuera de rango |
| 400 | Invalid delivery time | Hora de entrega inválida | "10:30" o "22:15" |
| 400 | Invalid delivery method | Método inválido | "helicoptero" |
| 404 | Product not found | Producto no encontrado | ID inexistente |
| 400 | Insufficient stock | Stock insuficiente | Solo 3 disponibles, solicitaste 5 |

---

### 4. Actualizar Cantidad de Producto
**PUT** `/items/:id`

#### Descripción
Actualiza la cantidad y opciones de entrega de un producto específico en el carrito.

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
  "quantity": 3,
  "horaEntregaPreferida": "19:30",
  "metodoEntrega": "manos",
  "notasEntrega": "Llamar 5 minutos antes"
}
```

#### Validaciones
- **quantity**: Número entero mínimo 1, opcional
- **horaEntregaPreferida**: String HH:MM, entre 12:00 y 21:00, opcional
- **metodoEntrega**: "puerta", "manos", "recepcion", opcional
- **notasEntrega**: String máximo 500 caracteres, opcional

#### Respuesta Exitosa (200)
```json
{
  "message": "Cart item updated successfully",
  "cartItem": {
    "id": "uuid",
    "usuario_id": "uuid",
    "producto_id": 123,
    "cantidad": 3,
    "hora_entrega_preferida": "19:30",
    "metodo_entrega": "manos",
    "notas_entrega": "Llamar 5 minutos antes"
  }
}
```

#### Características
- ✅ Actualización parcial de campos (solo los enviados se actualizan)
- ✅ Validación de propiedad del item
- ✅ Verificación de stock en tiempo real
- ✅ Validación de horarios y métodos de entrega

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
- ✅ Operación idempotente

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
- ✅ Eliminación masiva de todos los items
- ✅ Operación atómica (todo o nada)
- ✅ Operación idempotente

---

### 7. Configurar Opciones de Entrega
**PUT** `/delivery-options`

#### Descripción
Configura las opciones de entrega para todo el carrito. Estas opciones se aplican a una sola entrega que incluye todos los items.

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
- **horaEntregaPreferida**: String en formato HH:MM, entre 11:00 y 21:00, por defecto "18:00"
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
- ✅ Validación de horarios de entrega (11:00 AM - 9:00 PM)
- ✅ Métodos de entrega: puerta, manos, recepción
- ✅ Aplicación automática a todo el carrito por defecto

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
Aplica un cupón de descuento o envío gratis al carrito y devuelve el resumen calculado.

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

#### Respuesta Exitosa (200) - Cupón de Descuento
```json
{
  "message": "Coupon applied successfully",
  "coupon": {
    "id": 1,
    "code": "DESCUENTO20",
    "discount": 20,
    "type": "discount",
    "description": "20% de descuento"
  },
  "cartSummary": {
    "subtotal": 1199.98,
    "totalTPS": 59.99,
    "totalTVQ": 119.98,
    "totalConsigne": 0.50,
    "totalTaxes": 180.47,
    "shippingCost": 8.99,
    "originalShippingCost": 8.99,
    "discountAmount": 277.89,
    "total": 1111.55,
    "itemCount": 2,
    "freeShippingApplied": false,
    "savings": 277.89
  }
}
```

#### Respuesta Exitosa (200) - Cupón de Envío Gratis
```json
{
  "message": "Coupon applied successfully",
  "coupon": {
    "id": 2,
    "code": "ENVIOGRATIS",
    "discount": 0,
    "type": "free_shipping",
    "description": "Envío gratis"
  },
  "cartSummary": {
    "subtotal": 1199.98,
    "totalTPS": 59.99,
    "totalTVQ": 119.98,
    "totalConsigne": 0.50,
    "totalTaxes": 180.47,
    "shippingCost": 0.00,
    "originalShippingCost": 8.99,
    "discountAmount": 0,
    "total": 1380.45,
    "itemCount": 2,
    "freeShippingApplied": true,
    "savings": 8.99
  }
}
```

#### Tipos de Cupones
1. **Cupones de Descuento**: Código normal - aplica % de descuento al total completo
2. **Cupones de Envío Gratis**: Código que inicia con `ENVIO` o `SHIP` - elimina costo de envío

#### Características
- ✅ **Descuento sobre total completo**: Incluye subtotal + impuestos + envío
- ✅ **Envío gratis**: Cupones especiales eliminan el costo de envío
- ✅ Validación de existencia y vigencia
- ✅ Rate limiting para prevenir abuso
- ✅ Cálculo de ahorros totales

#### Errores Posibles
| Código | Error | Descripción |
|--------|-------|-------------|
| 400 | Empty cart | Carrito vacío |
| 404 | Invalid coupon | Cupón no encontrado |
| 400 | Coupon expired | Cupón expirado |
| 429 | Too Many Requests | Rate limit excedido |

---

## 📋 Casos de Uso Comunes

### Flujo Completo de Carrito de Compras

#### 1. Agregar Productos al Carrito con Opciones de Entrega
```bash
# Agregar primer producto con opciones de entrega
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 123,
    "quantity": 2,
    "horaEntregaPreferida": "19:00",
    "metodoEntrega": "manos",
    "notasEntrega": "Apartamento 3B - Llamar al llegar"
  }'
```

#### 2. Aplicar Cupón de Descuento
```bash
# Aplicar cupón de 20% de descuento
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/apply-coupon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "DESCUENTO20"
  }'
```

#### 3. Aplicar Cupón de Envío Gratis
```bash
# Aplicar cupón de envío gratis
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/apply-coupon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "ENVIOGRATIS"
  }'
```

#### 4. Ver Carrito con Cupón Aplicado
```bash
# Ver carrito con cupón de descuento
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/with-coupon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "DESCUENTO20"
  }'

# Ver carrito con cupón de envío gratis
curl -X POST https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/with-coupon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "ENVIOGRATIS"
  }'
```

#### 5. Configurar Opciones de Entrega para Todo el Carrito
```bash
# Configurar entrega para todo el carrito
curl -X PUT https://backendtoutaunclicla-production.up.railway.app/api/v1/cart/delivery-options \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "horaEntregaPreferida": "20:00",
    "metodoEntrega": "recepcion",
    "notasEntrega": "Dejar en recepción con el portero",
    "aplicarATodos": true
  }'
```

---

## 🔧 Reglas de Negocio

### Sistema de Cupones Avanzado
- ✅ **Cupones de Descuento**: Aplican porcentaje sobre el total completo (subtotal + impuestos + envío)
- ✅ **Cupones de Envío Gratis**: Códigos que inician con `ENVIO` o `SHIP` eliminan el costo de envío ($8.99 CAD)
- ✅ **Un cupón por sesión**: Solo se puede aplicar un cupón a la vez
- ✅ **Validación de vigencia**: Cupones con fecha de expiración obligatoria
- ✅ **Cálculo de ahorros**: Se muestran ahorros totales (descuento + envío gratis)

### Opciones de Entrega
- ✅ **Una sola entrega**: Todos los items del carrito se entregan juntos
- ✅ **Horarios controlados**: Entregas entre 11:00 AM y 9:00 PM
- ✅ **Métodos flexibles**: Entrega en puerta, manos o recepción
- ✅ **Configuración por item**: Cada producto puede tener opciones específicas
- ✅ **Configuración global**: Aplicar mismas opciones a todo el carrito

### Cálculo de Costos
- ✅ **Envío**: $8.99 CAD (gratis para pedidos ≥ $200 CAD)
- ✅ **Impuestos por producto**: TPS (federal), TVQ (provincial), Consigne
- ✅ **Descuentos sobre total**: Se aplican después de sumar impuestos y envío
- ✅ **Transparencia**: Desglose completo de todos los costos

### Gestión de Stock
- ✅ **Validación en tiempo real**: Stock verificado en cada operación
- ✅ **Protección contra sobreventa**: Límites estrictos de cantidad
- ✅ **Stock dinámico**: Consulta actualizada en cada petición

---

## 📊 Estructura de Datos

### Esquema de Base de Datos Actualizado

#### Tabla `carrito`
```sql
create table public.carrito (
  id uuid not null default gen_random_uuid(),
  usuario_id uuid not null,
  producto_id bigint not null,
  cantidad integer not null,
  hora_entrega_preferida time without time zone default '18:00'::time,
  metodo_entrega text default 'puerta'::text,
  notas_entrega text,
  constraint carrito_pkey primary key (id),
  constraint carrito_unico unique (usuario_id, producto_id),
  constraint carrito_cantidad_check check ((cantidad > 0)),
  constraint carrito_hora_check check ((hora_entrega_preferida >= '11:00:00'::time AND hora_entrega_preferida <= '21:00:00'::time)),
  constraint carrito_metodo_check check ((metodo_entrega = ANY (ARRAY['puerta'::text, 'manos'::text, 'recepcion'::text])))
);
```

#### Tabla `cupones`
```sql
create table public.cupones (
  id bigint generated always as identity not null,
  codigo text not null unique,
  descuento numeric not null,
  fecha_expiracion date,
  constraint cupones_pkey primary key (id)
);
```

### Cálculos Automáticos Actualizados

#### Fórmulas de Totales
```javascript
// Subtotal (antes de impuestos y descuentos)
subtotal = Σ(producto.precio × cantidad)

// Impuestos por producto
totalTPS = Σ((producto.precio × producto.TPS / 100) × cantidad)
totalTVQ = Σ((producto.precio × producto.TVQ / 100) × cantidad) 
totalConsigne = Σ(producto.consigne × cantidad)
totalTaxes = totalTPS + totalTVQ + totalConsigne

// Costo de envío
shippingCost = subtotal >= 200 ? 0 : 8.99

// Total antes de descuento
totalBeforeDiscount = subtotal + totalTaxes + shippingCost

// Descuentos
if (cupón.código.startsWith('ENVIO') || cupón.código.startsWith('SHIP')) {
  // Cupón de envío gratis
  finalShippingCost = 0
  discountAmount = 0
  savings = shippingCost
} else {
  // Cupón de descuento regular
  discountAmount = (totalBeforeDiscount × cupón.descuento) / 100
  finalShippingCost = shippingCost
  savings = discountAmount
}

// Total final
total = subtotal + totalTaxes + finalShippingCost - discountAmount
```

---

## ⚠️ Notas Importantes

### Para Desarrolladores Frontend
- 🎟️ **Tipos de Cupones**: Detectar tipo por prefijo del código (`ENVIO`/`SHIP` = envío gratis)
- 💰 **Mostrar Ahorros**: Usar campo `savings` para mostrar ahorros totales al usuario
- 📊 **Desglose de Costos**: Mostrar `originalShippingCost` vs `shippingCost` cuando aplique envío gratis
- 🚀 **UI Reactiva**: Actualizar interfaz basada en `appliedCoupon.type` y `freeShippingApplied`

### Ejemplos de Cupones
```sql
-- Cupón de descuento 15%
INSERT INTO cupones (codigo, descuento, fecha_expiracion) 
VALUES ('DESC15', 15, '2024-12-31');

-- Cupón de descuento 25%
INSERT INTO cupones (codigo, descuento, fecha_expiracion) 
VALUES ('VERANO25', 25, '2024-09-30');

-- Cupón de envío gratis
INSERT INTO cupones (codigo, descuento, fecha_expiracion) 
VALUES ('ENVIOGRATIS', 0, '2024-12-31');

-- Cupón de envío gratis con prefijo alternativo
INSERT INTO cupones (codigo, descuento, fecha_expiracion) 
VALUES ('SHIP2024', 0, '2024-12-31');
```

### Para Testing
- 🧪 **Datos de prueba**: Crear cupones de ambos tipos para testing completo
- 🎟️ **Prefijos de cupones**: Probar cupones que inician con `ENVIO` y `SHIP`
- 🔄 **Rate limiting**: Considerar límites al probar aplicación de cupones
- 💸 **Cálculo de ahorros**: Verificar que `savings` incluya descuento + envío gratis

### Para Producción
- 📈 **Monitoring**: Monitorear uso de cupones por tipo y efectividad
- 🔐 **Seguridad**: Validar prefijos de cupones de envío gratis
- 💾 **Analytics**: Rastrear conversión por tipo de cupón
- 🚀 **Performance**: Optimizar consultas de cupones con índices apropiados