# 🚀 Rutas de API Stripe - Guía de Implementación

## 📋 Endpoints Disponibles

### 1. **Crear Sesión de Checkout**
```
POST /api/v1/stripe/checkout/create-session
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "shipping_address_id": "uuid-of-shipping-address",
  "coupon_code": "OPCIONAL123",
  "success_url": "https://yourapp.com/success",
  "cancel_url": "https://yourapp.com/cancel"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/pay/cs_test_...",
  "orderSummary": {
    "items": [...],
    "subtotal": "45.99",
    "tps": "2.30",
    "tvq": "4.59",
    "consigne": "1.00",
    "originalShippingCost": "10.00",
    "shippingCost": "0.00",
    "shippingDiscount": "10.00",
    "promotionApplied": true,
    "freeShipping": false,
    "discount": "0.00",
    "total": "53.88",
    "savings": "10.00"
  }
}
```

---

### 2. **Verificar Estado de Sesión**
```
GET /api/v1/stripe/checkout/session-status/:sessionId
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Respuesta exitosa (200):**
```json
{
  "sessionId": "cs_test_...",
  "status": "complete",
  "payment_status": "paid",
  "order": {
    "id": 123,
    "estado": "confirmado",
    "total": 53.88
  }
}
```

---

### 3. **Webhook (Para uso interno)**
```
POST /api/v1/stripe/webhook
```
*Este endpoint es solo para Stripe - no llamar directamente*

---

## 🎯 Implementación Frontend

### JavaScript/TypeScript
```javascript
const createCheckoutSession = async (addressId, couponCode = '') => {
  try {
    const response = await fetch('/api/v1/stripe/checkout/create-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shipping_address_id: addressId,
        coupon_code: couponCode,
        success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/checkout/cancel`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Redirigir a Stripe Checkout
      window.location.href = data.url;
    } else {
      console.error('Error:', data.message);
    }
  } catch (error) {
    console.error('❌ Error en checkout:', error);
  }
};
```

### React Hook Example
```javascript
import { useState } from 'react';

const useStripeCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createSession = async (addressId, couponCode = '') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/stripe/checkout/create-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shipping_address_id: addressId,
          coupon_code: couponCode
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        window.location.href = data.url;
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ Error en checkout:', err);
    } finally {
      setLoading(false);
    }
  };

  return { createSession, loading, error };
};
```

---

## 🏪 Promociones y Descuentos

### Promoción Maison de Poulet (Temporal - hasta 31 agosto 2025)
Cuando el carrito contiene productos de **Maison de Poulet** (subcategoría_id = 13) y la dirección está en **Riviera Sur**:

- ✅ `shippingCost: "0.00"` (cliente no paga envío)
- ✅ `originalShippingCost: "10.00"` (lo que habría costado)
- ✅ `shippingDiscount: "10.00"` (descuento aplicado)
- ✅ `promotionApplied: true`
- ✅ `savings: "10.00"` (total ahorrado)

**En Stripe se muestra como:**
> "Envío (GRATIS - Promoción Maison de Poulet - ahorro $10.00)" - $0.00

---

## 🚨 Manejo de Errores

### Errores Comunes

**400 - Datos inválidos:**
```json
{
  "error": "Validation failed",
  "details": {
    "shipping_address_id": "must be a valid UUID"
  }
}
```

**401 - No autenticado:**
```json
{
  "error": "Unauthorized",
  "message": "Token required"
}
```

**404 - Dirección no encontrada:**
```json
{
  "error": "Address not found",
  "message": "Shipping address not found for user"
}
```

**500 - Error del servidor:**
```json
{
  "error": "Failed to create checkout session",
  "message": "Internal server error details..."
}
```

---

## 📝 Validaciones

### Campos Requeridos
- ✅ `shipping_address_id` (UUID válido)
- ✅ Usuario autenticado (JWT token)
- ✅ Carrito con items
- ✅ Dirección de envío activa

### Campos Opcionales
- `coupon_code` (string)
- `success_url` (URL válida)
- `cancel_url` (URL válida)

---

## 🔧 Testing

### Ejemplo con cURL
```bash
curl -X POST http://localhost:3000/api/v1/stripe/checkout/create-session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_address_id": "12345678-1234-1234-1234-123456789abc",
    "coupon_code": "ENVIO10"
  }'
```

### Datos de Prueba
- **Usuario ID:** Cualquier usuario válido con carrito
- **Dirección ID:** UUID de dirección existente del usuario
- **Cupón de prueba:** "ENVIO10" (si está configurado)
- **Productos Maison de Poulet:** Cualquier producto con subcategoria_id = 13

---

## 🎯 URLs Completas por Ambiente

### Desarrollo
```
POST http://localhost:3000/api/v1/stripe/checkout/create-session
GET  http://localhost:3000/api/v1/stripe/checkout/session-status/:sessionId
```

### Producción
```
POST https://api.toutaunclicla.com/api/v1/stripe/checkout/create-session
GET  https://api.toutaunclicla.com/api/v1/stripe/checkout/session-status/:sessionId
```

---

## 📊 Métricas y Logs

El backend registra automáticamente:
- ✅ Creación de sesiones exitosas
- ✅ Errores de validación
- ✅ Aplicación de cupones
- ✅ **Aplicación de promoción Maison de Poulet**
- ✅ Totales y descuentos aplicados

Buscar en logs: `🎉 PROMOCIÓN APLICADA: Domicilio gratis para Maison de Poulet`