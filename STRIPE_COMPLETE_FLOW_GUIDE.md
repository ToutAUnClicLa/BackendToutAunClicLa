# 🚀 Guía Completa del Flujo de Pagos con Stripe

Documentación completa del sistema de pagos integrado con variaciones, cupones, domicilios y entrega.

## 📋 Tabla de Contenidos
- [Rutas Disponibles](#rutas-disponibles)
- [Flujo Completo del Usuario](#flujo-completo-del-usuario)
- [Sistema de Domicilios](#sistema-de-domicilios)
- [Sistema de Cupones](#sistema-de-cupones)
- [Variaciones de Productos](#variaciones-de-productos)
- [Información de Entrega](#información-de-entrega)
- [Webhooks y Confirmación](#webhooks-y-confirmación)
- [Ejemplos Prácticos](#ejemplos-prácticos)

---

## 🛣️ Rutas Disponibles

### **Rutas de Stripe**
```
Base URL: /api/v1/stripe
```

| Método | Ruta | Descripción | Auth Requerida |
|--------|------|-------------|----------------|
| `POST` | `/checkout/create-session` | Crear sesión de pago | ✅ |
| `GET` | `/checkout/session-status/:sessionId` | Verificar estado de sesión | ✅ |
| `POST` | `/refund` | Crear reembolso (admin) | ✅ |
| `POST` | `/webhook` | Webhook de Stripe | ❌ |

### **Rutas del Carrito (Pre-Checkout)**
```
Base URL: /api/v1/cart
```

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Obtener carrito con totales |
| `POST` | `/items` | Agregar producto con variaciones |
| `PUT` | `/items/:id` | Actualizar cantidad/opciones |
| `POST` | `/apply-coupon` | Aplicar cupón |
| `DELETE` | `/remove-coupon` | Quitar cupón |
| `PUT` | `/delivery-options` | Configurar entrega |

---

## 🛍️ Flujo Completo del Usuario

### **Paso 1: Navegación y Selección de Productos**

#### **1.1 Cargar Producto con Variaciones**
```http
GET /api/v1/products/:id
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "id": 123,
  "nombre": "Haricot Traditionnel",
  "precio": 8.99,
  "variations": [
    {
      "id": 1,
      "group_name": "Tamaño",
      "group_type": "single_select",
      "is_required": true,
      "product_variations": [
        {"id": 10, "name": "Pequeño", "price_modifier": -2.00},
        {"id": 11, "name": "Mediano", "price_modifier": 0},
        {"id": 12, "name": "Grande", "price_modifier": 3.50}
      ]
    },
    {
      "id": 2,
      "group_name": "Extras",
      "group_type": "multi_select",
      "product_variations": [
        {"id": 20, "name": "Extra Salsa", "price_modifier": 2.50},
        {"id": 21, "name": "Extra Queso", "price_modifier": 3.00}
      ]
    }
  ]
}
```

#### **1.2 Agregar al Carrito con Variaciones**
```http
POST /api/v1/cart/items
Authorization: Bearer {token}
Content-Type: application/json

{
  "productId": 123,
  "quantity": 1,
  "variations": [
    {"variationId": 11, "quantity": 1},  // Mediano
    {"variationId": 20, "quantity": 2}   // Extra Salsa x2
  ],
  "horaEntregaPreferida": "19:00",
  "metodoEntrega": "manos",
  "tipoEntrega": "siguiente_dia",
  "notasEntrega": "Tocar timbre dos veces"
}
```

**Respuesta:**
```json
{
  "message": "Item added to cart successfully",
  "cartItem": {
    "id": "uuid-123",
    "cantidad": 1,
    "hora_entrega_preferida": "19:00",
    "metodo_entrega": "manos",
    "tipo_entrega": "siguiente_dia"
  },
  "variations": 2,
  "deliveryInfo": {
    "type": "siguiente_dia",
    "description": "Entrega programada para el día siguiente"
  }
}
```

### **Paso 2: Revisión del Carrito**

#### **2.1 Obtener Carrito Completo**
```http
GET /api/v1/cart
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "cartItems": [
    {
      "id": "uuid-123",
      "producto_id": 123,
      "cantidad": 1,
      "productos": {
        "nombre": "Haricot Traditionnel",
        "precio": 8.99,
        "TPS": 5,
        "TVQ": 9.975,
        "consigne": 0.25
      },
      "variations": [
        {
          "variation_id": 11,
          "quantity": 1,
          "price_at_time": 0,
          "product_variations": {"name": "Mediano"}
        },
        {
          "variation_id": 20,
          "quantity": 2,
          "price_at_time": 2.50,
          "product_variations": {"name": "Extra Salsa"}
        }
      ],
      "hora_entrega_preferida": "19:00",
      "metodo_entrega": "manos",
      "tipo_entrega": "siguiente_dia",
      "notas_entrega": "Tocar timbre dos veces"
    }
  ],
  "total": 17.31,
  "summary": {
    "subtotal": 13.99,        // 8.99 + 0 + (2.50 × 2)
    "totalTPS": 0.70,         // 5% sobre subtotal
    "totalTVQ": 1.39,         // 9.975% sobre subtotal
    "totalConsigne": 0.25,    // Depósito
    "shippingCost": 7,        // Calculado por backend
    "discountAmount": 0,
    "total": 17.31
  }
}
```

#### **2.2 Aplicar Cupón (Opcional)**
```http
POST /api/v1/cart/apply-coupon
Authorization: Bearer {token}
Content-Type: application/json

{
  "couponCode": "ENVIOGRATIS"
}
```

**Respuesta:**
```json
{
  "message": "Coupon applied successfully",
  "coupon": {
    "code": "ENVIOGRATIS",
    "type": "free_shipping",
    "description": "Envío gratis"
  },
  "cartSummary": {
    "subtotal": 13.99,
    "shippingCost": 0,         // ✅ Gratis por cupón
    "originalShippingCost": 7,
    "total": 16.33,            // Sin costo de envío
    "savings": 7.00            // Ahorro en envío
  }
}
```

### **Paso 3: Configuración de Entrega**

#### **3.1 Configurar Dirección de Envío**
```http
POST /api/v1/addresses
Authorization: Bearer {token}

{
  "direccion": "123 Rue Saint-Laurent",
  "ciudad": "Montreal",
  "estado": "QC",
  "codigo_postal": "H2X 2T3",
  "pais": "Canada"
}
```

#### **3.2 Actualizar Opciones de Entrega**
```http
PUT /api/v1/cart/delivery-options
Authorization: Bearer {token}

{
  "horaEntregaPreferida": "20:00",
  "metodoEntrega": "recepcion",
  "tipoEntrega": "estandar",
  "notasEntrega": "Dejar en recepción del edificio",
  "aplicarATodos": true
}
```

### **Paso 4: Proceso de Checkout con Stripe**

#### **4.1 Crear Sesión de Checkout**
```http
POST /api/v1/stripe/checkout/create-session
Authorization: Bearer {token}
Content-Type: application/json

{
  "shipping_address_id": "address-uuid-123",
  "coupon_code": "ENVIOGRATIS",
  "success_url": "https://app.toutaunclicla.com/checkout/success",
  "cancel_url": "https://app.toutaunclicla.com/cart"
}
```

**Respuesta:**
```json
{
  "success": true,
  "sessionId": "cs_test_123456789",
  "url": "https://checkout.stripe.com/c/pay/cs_test_123456789",
  "orderSummary": {
    "items": [
      {
        "producto_id": 123,
        "cantidad": 1,
        "precio_unitario": 8.99,
        "precio_con_variaciones": 13.99,
        "variation_modifier": 5.00,
        "variations": [...]
      }
    ],
    "subtotal": "13.99",
    "tps": "0.70",
    "tvq": "1.39",
    "consigne": "0.25",
    "shippingCost": "0.00",         // Gratis por cupón
    "originalShippingCost": "7.00",
    "freeShipping": true,
    "discount": "0.00",
    "total": "16.33",
    "coupon": {
      "codigo": "ENVIOGRATIS",
      "type": "free_shipping"
    },
    "savings": "7.00"
  }
}
```

#### **4.2 Redireccionar a Stripe Checkout**
```javascript
// Frontend: Redirigir automáticamente
window.location.href = response.url;
// O usar Stripe.js para embedded checkout
```

### **Paso 5: Completar Pago en Stripe**

El usuario completa el pago en la interfaz de Stripe. Automáticamente:

1. **Stripe envía webhook** → `POST /api/v1/stripe/webhook`
2. **Backend crea la orden** automáticamente
3. **Se envían emails** al usuario y admin
4. **Se actualiza stock** de productos
5. **Se limpia el carrito**

#### **5.1 Verificar Estado de la Sesión (Opcional)**
```http
GET /api/v1/stripe/checkout/session-status/cs_test_123456789
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "sessionId": "cs_test_123456789",
  "status": "complete",
  "payment_status": "paid",
  "amount_total": 1633,  // En centavos
  "currency": "cad",
  "order": {
    "id": 1001,
    "estado": "pagado",
    "total": 16.33,
    "fecha_pedido": "2024-01-15T10:30:00Z"
  }
}
```

---

## 🚚 Sistema de Domicilios

### **Calculadora de Costos Avanzada**

El backend calcula automáticamente el costo de domicilio basado en:

#### **1. Ubicación del Usuario (Código Postal)**
- **Montreal**: Zona regular
- **Riviera Sur**: Zona sur (códigos J3V, J3W, J3X, etc.)

#### **2. Categorías de Productos**
- **Categoría 1**: Productos generales
- **Categoría 2**: Comidas (requiere ubicación de restaurante)  
- **Categoría 3**: Boutique

#### **3. Reglas de Cálculo**
```javascript
// Envío gratis automático
if (subtotal >= 200) return 0;

// Solo productos
if (hasProducts && !hasFood) {
  return userZone === 'riviera_sur' ? 7 : 17;
}

// Solo comidas
if (hasFood && !hasProducts) {
  // Calcula distancia entre restaurante y usuario
  return calculateFoodDelivery(restaurants, userLocation);
}

// Pedido mixto (productos + comidas)
if (hasProducts && hasFood) {
  // Cálculo complejo con límites $10-25
  return calculateMixedOrder(items, userLocation);
}
```

#### **4. Ejemplo de Cálculo**
```json
{
  "user": {
    "postal_code": "H2X 2T3",
    "zone": "montreal"
  },
  "cart": [
    {"categoria_id": 1, "precio": 25.00, "cantidad": 1},  // Producto
    {"categoria_id": 2, "precio": 15.00, "cantidad": 1}   // Comida
  ],
  "calculation": {
    "subtotal": 40.00,
    "type": "mixed_order",
    "base_shipping": 15.00,
    "final_shipping": 15.00,
    "reason": "Mixed order - Montreal zone"
  }
}
```

---

## 🎫 Sistema de Cupones

### **Tipos de Cupones**

#### **1. Cupones de Descuento**
- **Aplicación**: Sobre subtotal + impuestos + consigne (SIN envío)
- **Formato**: Cualquier código
- **Ejemplo**: `SAVE15` = 15% de descuento

```http
POST /api/v1/cart/apply-coupon
{
  "couponCode": "SAVE15"
}
```

**Resultado:**
```json
{
  "coupon": {
    "type": "discount",
    "discount": 15,
    "description": "15% de descuento"
  },
  "cartSummary": {
    "subtotal": 50.00,
    "taxes": 7.50,
    "consigne": 1.00,
    "shipping": 7.00,
    "discountAmount": 8.78,    // 15% de (50 + 7.50 + 1.00)
    "total": 56.72             // Total - descuento
  }
}
```

#### **2. Cupones de Envío Gratis**
- **Identificación**: Códigos que empiezan con `ENVIO`, `SHIP`, `DOMICILIO` o descuento = 0
- **Aplicación**: Elimina costo de envío completamente

```http
POST /api/v1/cart/apply-coupon
{
  "couponCode": "ENVIOGRATIS"
}
```

**Resultado:**
```json
{
  "coupon": {
    "type": "free_shipping",
    "description": "Envío gratis"
  },
  "cartSummary": {
    "subtotal": 50.00,
    "taxes": 7.50,
    "consigne": 1.00,
    "shippingCost": 0,           // ✅ Gratis por cupón
    "originalShippingCost": 7.00,
    "discountAmount": 0,
    "total": 58.50,
    "savings": 7.00              // Ahorro en envío
  }
}
```

#### **3. Límites de Uso**
- **Por Usuario**: Campo `limite_usos` controla usos por usuario
- **Tracking**: Tabla `cupones_usos` registra cada uso
- **Validación**: Se verifica antes de aplicar

---

## 🎯 Variaciones de Productos

### **Estructura en Base de Datos**
```sql
variation_groups     → "Tamaño", "Extras", "Opciones"
product_variations   → "Mediano", "Extra Salsa", etc.
cart_item_variations → Selecciones en carrito
order_item_variations → Snapshot en pedido final
```

### **Flujo de Variaciones**

#### **1. Selección en Frontend**
```javascript
const selectedVariations = [
  {variationId: 11, quantity: 1},  // Tamaño Mediano
  {variationId: 20, quantity: 2}   // Extra Salsa x2
];

// Cálculo de precio:
const basePrice = 8.99;
const variationCost = (0 × 1) + (2.50 × 2) = 5.00;
const finalPrice = 8.99 + 5.00 = 13.99;
```

#### **2. En el Carrito**
```json
{
  "productos": {"nombre": "Haricot Traditionnel", "precio": 8.99},
  "variations": [
    {
      "variation_id": 11,
      "quantity": 1,
      "price_at_time": 0,
      "product_variations": {"name": "Mediano"}
    },
    {
      "variation_id": 20, 
      "quantity": 2,
      "price_at_time": 2.50,
      "product_variations": {"name": "Extra Salsa"}
    }
  ]
}
```

#### **3. En Stripe Checkout**
```json
{
  "line_items": [
    {
      "price_data": {
        "product_data": {
          "name": "Haricot Traditionnel (Tamaño: Mediano, Extra: Salsa x2)",
          "metadata": {
            "producto_id": "123",
            "has_variations": "true",
            "variation_modifier": "5.00"
          }
        },
        "unit_amount": 1399  // $13.99 en centavos
      },
      "quantity": 1
    }
  ]
}
```

#### **4. En la Orden Final**
```sql
-- Tabla: detalles_pedido
precio_unitario: 13.99  -- Precio final con variaciones

-- Tabla: order_item_variations (snapshot inmutable)
variation_name: "Mediano"
price_modifier: 0
quantity: 1

variation_name: "Extra Salsa" 
price_modifier: 2.50
quantity: 2
```

---

## 📦 Información de Entrega

### **Configuración de Entrega**

#### **1. Tipos de Entrega**
- **`estandar`**: 2-3 días hábiles (default para pedidos antes de 8 PM)
- **`siguiente_dia`**: Entrega al día siguiente (automático después de 8 PM)

#### **2. Métodos de Entrega**
- **`puerta`**: Dejar en la puerta
- **`manos`**: Entrega en mano (require presencia)
- **`recepcion`**: Dejar en recepción/portería

#### **3. Horarios Disponibles**
- **Ventana**: 11:00 AM - 9:00 PM (hora de Montreal)
- **Orden límite**: 8:00 PM para entrega mismo día
- **Aviso mínimo**: 1 hora de anticipación

#### **4. Validación Automática**
```javascript
// Backend valida automáticamente:
const validationResult = validateDeliveryTimeAndType(
  "22:00",      // Hora solicitada
  "estandar"    // Tipo solicitado
);

// Si es inválido:
{
  "valid": false,
  "error": "Time 22:00 not available today",
  "availableHours": ["11:00", "11:30", ..., "21:00"],
  "suggestTomorrow": true
}
```

### **Configuración Global vs Individual**

#### **Global (Para todo el carrito)**
```http
PUT /api/v1/cart/delivery-options
{
  "horaEntregaPreferida": "19:00",
  "metodoEntrega": "manos", 
  "aplicarATodos": true     // ✅ Aplica a todos los items
}
```

#### **Individual (Por producto)**
```http
PUT /api/v1/cart/items/uuid-123
{
  "horaEntregaPreferida": "20:00",
  "metodoEntrega": "recepcion"  // Solo para este item
}
```

---

## ⚡ Webhooks y Confirmación

### **Flujo de Webhook Automático**

#### **1. Usuario Completa Pago en Stripe**
```
Stripe Checkout → Payment Success → Stripe sends webhook
```

#### **2. Backend Recibe Webhook**
```http
POST /api/v1/stripe/webhook
Content-Type: application/json
Stripe-Signature: t=1234567,v1=signature...

{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_123456789",
      "payment_status": "paid",
      "metadata": {
        "user_id": "user-uuid",
        "shipping_address_id": "addr-uuid",
        "coupon_code": "ENVIOGRATIS",
        "total": "16.33"
      }
    }
  }
}
```

#### **3. Backend Crea Orden Automáticamente**
```javascript
// stripeController.js - handleWebhook()
switch (event.type) {
  case 'checkout.session.completed':
    const order = await createOrderFromCheckoutSession(session);
    await sendOrderConfirmationEmail(order.id);
    await sendAdminOrderNotification(order.id);
    break;
}
```

#### **4. Orden Completa en Base de Datos**
```sql
-- Tabla: pedidos
id: 1001
usuario_id: user-uuid
total: 16.33
estado: 'pagado'
stripe_payment_intent_id: 'pi_123456'
codigo_cupon: 'ENVIOGRATIS'
hora_entrega_preferida: '19:00'
metodo_entrega: 'manos'
tipo_entrega: 'siguiente_dia'

-- Tabla: detalles_pedido  
pedido_id: 1001
producto_id: 123
cantidad: 1
precio_unitario: 13.99  -- Con variaciones incluidas

-- Tabla: order_item_variations
detalle_pedido_id: detail-uuid
variation_name: 'Mediano'
price_modifier: 0
quantity: 1
```

#### **5. Emails Automáticos**
- ✅ **Usuario**: Confirmación con detalles completos
- ✅ **Admin**: Notificación con instrucciones de preparación
- ✅ **Registro**: Estado de email en base de datos

---

## 🔥 Ejemplos Prácticos

### **Ejemplo 1: Pedido Simple con Envío Gratis**

#### **Escenario:**
- Usuario: Montreal (H2X 2T3)
- Producto: 2x Haricot Grande ($12.49 c/u)
- Subtotal: $24.98 (< $200, no envío gratis automático)
- Cupón: "DOMICILIOGRATIS" 

#### **Flujo:**
```bash
# 1. Agregar productos al carrito
POST /api/v1/cart/items
{
  "productId": 123,
  "quantity": 2, 
  "variations": [{"variationId": 12, "quantity": 1}]  # Grande
}

# 2. Ver carrito (con envío calculado)
GET /api/v1/cart
# Respuesta: shippingCost: 17 (Montreal, solo productos)

# 3. Aplicar cupón de envío gratis  
POST /api/v1/cart/apply-coupon
{"couponCode": "DOMICILIOGRATIS"}
# Respuesta: shippingCost: 0, savings: 17.00

# 4. Crear checkout
POST /api/v1/stripe/checkout/create-session
{
  "shipping_address_id": "addr-uuid",
  "coupon_code": "DOMICILIOGRATIS"
}

# 5. Pago → Webhook automático → Orden creada
```

#### **Resultado Final:**
```json
{
  "order": {
    "id": 1001,
    "subtotal": 24.98,
    "tps": 1.25,
    "tvq": 2.49, 
    "shipping": 0,           // Gratis por cupón
    "originalShipping": 17,
    "total": 28.72,
    "coupon": "DOMICILIOGRATIS",
    "savings": 17.00
  }
}
```

### **Ejemplo 2: Pedido Mixto con Descuento**

#### **Escenario:**
- Usuario: Riviera Sur (J4B 1A1)
- Items: 1x Producto ($30) + 1x Comida ($20)
- Cupón: "SAVE20" (20% descuento)
- Entrega: Mañana a las 14:00

#### **Flujo:**
```bash
# 1. Agregar productos
POST /api/v1/cart/items (producto)
POST /api/v1/cart/items (comida)

# 2. Configurar entrega
PUT /api/v1/cart/delivery-options
{
  "horaEntregaPreferida": "14:00",
  "tipoEntrega": "siguiente_dia",
  "metodoEntrega": "manos"
}

# 3. Aplicar descuento
POST /api/v1/cart/apply-coupon  
{"couponCode": "SAVE20"}

# 4. Checkout y pago
```

#### **Cálculo de Costos:**
```javascript
// Subtotal: $50.00
// Impuestos: $7.50 (TPS + TVQ)
// Consigne: $1.00
// Envío mixto (Riviera Sur): $12.00
// Descuento 20% sobre (50 + 7.50 + 1.00): -$11.70
// Total: $50 + $7.50 + $1.00 + $12.00 - $11.70 = $58.80
```

### **Ejemplo 3: Pedido Urgente Siguiente Día**

#### **Escenario:**  
- Usuario hace pedido a las 8:30 PM
- Sistema detecta automáticamente → `tipo_entrega: "siguiente_dia"`
- Admin recibe email con prioridad URGENTE

#### **Flujo Automático:**
```javascript
// Backend detecta automáticamente:
const montrealTime = getMontrealTime(); // 20:30
const isAfterCutoff = montrealTime.getHours() >= 20; // true

// Auto-asigna siguiente_dia
const finalTipoEntrega = isAfterCutoff ? 'siguiente_dia' : 'estandar';
```

#### **Email Admin (Urgente):**
```
Subject: ⚡ URGENT - Next Day New Order #1001
Content:
🛒 NUEVO PEDIDO RECIBIDO!
⏰ ACCIÓN REQUERIDA: Nuevo pedido URGENTE

⚡ NEXT DAY DELIVERY (¡URGENTE!)
⏰ Hora preferida: 14:00  
👋 Entrega en mano requerida

🎯 PRÓXIMOS PASOS:
⚡ URGENTE: Debe entregarse mañana 12:00-21:00
👋 Entrega en mano requerida - cliente debe estar presente
```

---

## 🛠️ Configuración y Mejores Prácticas

### **Variables de Entorno Requeridas**
```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URLs
FRONTEND_URL=https://app.toutaunclicla.com

# Email
RESEND_API_KEY=re_...
```

### **Configuración de Webhook en Stripe**
```bash
# URL del webhook:
https://api.toutaunclicla.com/api/v1/stripe/webhook

# Eventos a escuchar:
- checkout.session.completed
- checkout.session.expired
```

### **Testing con Stripe**

#### **Tarjetas de Prueba:**
```javascript
// Pago exitoso
4242 4242 4242 4242

// Pago fallido
4000 0000 0000 0002

// Requiere autenticación 3D
4000 0025 0000 3155
```

#### **Cupones de Prueba:**
```sql
INSERT INTO cupones VALUES
('SAVE15', 15, NULL, true),           -- 15% descuento
('ENVIOGRATIS', 0, NULL, true),       -- Envío gratis
('SAVE50', 50, 1, true);              -- 50% descuento, 1 uso por usuario
```

### **Monitoreo y Logs**
```javascript
// El sistema logea automáticamente:
console.log('✅ Stripe Checkout Session creada:', {
  sessionId, userId, total, items, couponApplied
});

console.log('✅ Orden creada exitosamente:', order.id);
console.log('✅ Emails de confirmación enviados');
```

---

## 🚨 Manejo de Errores

### **Errores Comunes y Soluciones**

#### **1. Carrito Vacío**
```json
{
  "error": "Empty cart",
  "message": "Your cart is empty. Add items before checkout."
}
```

#### **2. Stock Insuficiente**
```json
{
  "error": "Insufficient stock", 
  "message": "Only 3 units of Haricot Traditionnel available"
}
```

#### **3. Hora de Entrega Inválida**
```json
{
  "error": "Invalid delivery configuration",
  "message": "Time 22:00 not available today",
  "availableHours": ["11:00", "11:30", ..., "21:00"]
}
```

#### **4. Cupón Inválido**
```json
{
  "error": "Invalid coupon",
  "message": "Has alcanzado el límite de uso para este cupón (5 veces)"
}
```

#### **5. Dirección Inválida**
```json
{
  "error": "Invalid shipping address",
  "message": "Please select a valid shipping address"
}
```

---

## 📈 Métricas y Analytics

### **Datos que se Trackean Automáticamente:**
- ✅ Conversión de carrito a checkout
- ✅ Uso de cupones por tipo
- ✅ Preferencias de entrega
- ✅ Costos de envío por zona
- ✅ Productos con variaciones más populares
- ✅ Horas de entrega preferidas
- ✅ Métodos de entrega utilizados

### **Reportes Disponibles:**
```sql
-- Pedidos por tipo de entrega
SELECT tipo_entrega, COUNT(*) 
FROM pedidos 
GROUP BY tipo_entrega;

-- Cupones más utilizados  
SELECT codigo_cupon, COUNT(*) 
FROM pedidos 
WHERE codigo_cupon IS NOT NULL
GROUP BY codigo_cupon;

-- Envío gratis por umbral vs cupón
SELECT 
  envio_gratis,
  aplicado_envio_gratis, 
  COUNT(*)
FROM pedidos
GROUP BY envio_gratis, aplicado_envio_gratis;
```

---

## 🎯 Próximos Pasos y Mejoras

### **Funcionalidades Futuras:**
- [ ] Suscripciones recurrentes con Stripe
- [ ] Pagos en cuotas
- [ ] Múltiples métodos de pago
- [ ] Tracking de envío en tiempo real
- [ ] Notificaciones push para estado de pedidos
- [ ] Programa de lealtad integrado

### **Optimizaciones Técnicas:**
- [ ] Cache de cálculos de envío
- [ ] Batch processing de webhooks
- [ ] Retry automático de emails fallidos
- [ ] Compresión de respuestas de API

---

*Documentación actualizada: Enero 2025*
*Sistema completamente funcional e integrado* ✅