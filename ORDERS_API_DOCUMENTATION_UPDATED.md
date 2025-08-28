# API de Pedidos - Documentación Completa

## 📋 Endpoints de Pedidos Optimizados para Frontend

Esta documentación describe los endpoints de pedidos optimizados para proporcionar información completa para las páginas de cuenta de usuario y gestión de pedidos.

---

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT:

```
Authorization: Bearer <jwt_token>
```

**Base URL:** `https://backendtoutaunclicla-production.up.railway.app/api/v1/orders`

---

## 🚚 **Nuevas Funcionalidades de Envío y Entrega**

### **Campos Actualizados en Pedidos**

#### **1. Información de Envío Avanzada**
```json
"pricing": {
  "shipping": 17,                    // Costo final de envío
  "originalShipping": 17,           // Costo original antes de descuentos
  "shippingMethod": "Cálculo avanzado por ubicación",
  "couponType": "free_shipping",    // Tipo de cupón aplicado
  "freeShippingApplied": true       // Si se aplicó envío gratis
}
```

#### **2. Información de Entrega**
```json
"delivery": {
  "preferredTime": "18:00",         // Hora preferida de entrega
  "method": "puerta",               // Método: puerta, manos, recepcion
  "type": "estandar",               // Tipo: estandar, siguiente_dia
  "notes": "Apartamento 3B - Tocar timbre"  // Notas especiales
}
```

### **Métodos de Entrega Disponibles**
| Valor | Descripción |
|-------|-------------|
| `puerta` | Dejar el pedido en la puerta |
| `manos` | Entregar directamente en mano |
| `recepcion` | Dejar en recepción/portería |

### **Tipos de Entrega**
| Valor | Descripción |
|-------|-------------|
| `estandar` | Entrega en 2-3 días hábiles |
| `siguiente_dia` | Entrega al día siguiente |

### **Tipos de Cupones**
| Valor | Descripción |
|-------|-------------|
| `discount` | Cupón de descuento porcentual |
| `free_shipping` | Cupón de envío gratis |

### **Cálculo de Envío Inteligente**

El sistema ahora calcula el envío basado en:
- **Ubicación del usuario**: Riviera Sur vs Montreal
- **Tipo de productos**: Solo productos, solo comidas, o mixto
- **Proximidad a restaurantes**: Para pedidos de comida

#### **Reglas de Cálculo**
1. **Solo productos/boutique**: Riviera Sur = $7, Montreal = $17
2. **Solo comidas**: Según proximidad al restaurante ($7-$17)
3. **Pedidos mixtos**: Rango dinámico ($10-$25)
4. **Envío gratis**: Pedidos ≥ $200 CAD

### **Campos de Base de Datos**

#### **Tabla `pedidos` - Nuevos Campos**
```sql
-- Información de entrega
hora_entrega_preferida TIME,           -- Hora preferida (12:00-21:00)
metodo_entrega TEXT DEFAULT 'puerta',  -- puerta, manos, recepcion
notas_entrega TEXT,                    -- Notas especiales de entrega
tipo_entrega TEXT DEFAULT 'estandar',  -- estandar, siguiente_dia

-- Información de cupones
tipo_cupon TEXT,                       -- discount, free_shipping
envio_gratis BOOLEAN DEFAULT false,    -- Si tiene envío gratis
costo_envio_original NUMERIC DEFAULT 0, -- Costo antes de descuentos
aplicado_envio_gratis BOOLEAN DEFAULT false -- Si se aplicó cupón gratis
```

---

## 👤 Endpoints para Usuarios

### **1. Obtener Mis Pedidos**

```http
GET /api/v1/orders/my-orders
```

**Descripción:** Obtiene el historial de pedidos del usuario autenticado con información completa.

**Query Parameters:**
```
page=1          # Página (opcional, default: 1)
limit=10        # Límite por página (opcional, default: 10)
status=pagado   # Filtrar por estado (opcional)
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 6,
        "orderNumber": "ORD-000006",
        "status": "pagado",
        "total": 27.29,
        "orderDate": "2025-08-20T22:23:30.536815+00:00",
        "pricing": {
          "subtotal": 18.30,
          "taxes": {
            "tps": 0,
            "tvq": 0,
            "total": 0
          },
          "shipping": 17,
          "originalShipping": 17,
          "shippingMethod": "Cálculo avanzado por ubicación",
          "discount": 0,
          "finalTotal": 36.30
        },
        "summary": {
          "totalItems": 1,
          "productCount": 1
        },
        "shipping": {
          "address": "123 Main St",
          "city": "Montreal",
          "state": "Quebec",
          "postalCode": "H1H 1H1",
          "country": "Canada",
          "fullAddress": "123 Main St, Montreal, Quebec H1H 1H1, Canada"
        },
        "delivery": {
          "preferredTime": "18:00",
          "method": "puerta",
          "type": "estandar",
          "notes": "Apartamento 3B - Tocar timbre"
        },
        "itemsPreview": [
          {
            "id": 1,
            "name": "Producto Ejemplo",
            "quantity": 1,
            "unitPrice": 18.30,
            "image": "https://ejemplo.com/imagen.jpg"
          }
        ],
        "paymentInfo": {
          "method": "stripe",
          "stripeSessionId": "cs_test_...",
          "paymentDate": "2025-08-20T22:23:30.536815+00:00"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalOrders": 25,
      "hasNextPage": true,
      "hasPreviousPage": false,
      "nextPage": 2,
      "previousPage": null
    }
  }
}
```

**Estados Posibles:**
- `pendiente` - Pedido creado, pago pendiente
- `pagado` - Pago confirmado
- `procesando` - En preparación
- `enviado` - Enviado al cliente
- `entregado` - Entregado exitosamente
- `cancelado` - Cancelado
- `reembolsado` - Reembolsado completo
- `parcialmente_reembolsado` - Reembolso parcial

---

Esta documentación proporciona toda la información necesaria para implementar una interfaz completa de gestión de pedidos en el frontend, con todas las nuevas funcionalidades de envío inteligente y opciones de entrega.