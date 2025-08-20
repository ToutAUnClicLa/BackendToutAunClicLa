# Implementación Frontend - Stripe Checkout Simplificado

## 🎯 Solo Stripe Checkout - Super Simple

El backend ahora maneja **únicamente Stripe Checkout**. No hay Payment Intents, no hay elementos de Stripe en el frontend. Solo 2 endpoints y redirección a Stripe.

---

## 🚀 API Endpoints Disponibles

### 1. **Crear Checkout Session**
```
POST /api/v1/stripe/checkout/create-session
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body que envías:**
```json
{
  "shipping_address_id": "550e8400-e29b-41d4-a716-446655440000",
  "coupon_code": "SAVE10",
  "success_url": "https://toutaunclicla.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://toutaunclicla.com/checkout/cancel"
}
```

**Respuesta que recibes:**
```json
{
  "success": true,
  "sessionId": "cs_test_b1x2RTdOuZpiceAxPkVBRkwOhghLcH58eaj6HJyYwOhaPJbJ1ltJp6mQLd",
  "url": "https://checkout.stripe.com/c/pay/cs_test_b1x2RTdOuZpiceAxPkVBRkwOhghLcH58eaj6HJyYwOhaPJbJ1ltJp6mQLd#fidkdWxOYHwnPyd1blpxYHZxWjA0V0hjV1xGNTxNZ3U1XTxuS2A1f0dEQmFPSTxASHJ0NlJLbn82cDx1QzN0NmFwMn9dVFV8a3VDR0A3YD11Vk5wTWdKb2xNckFTZGlfQkp0MjFCf399T3BSNTV%2FfGZcVUF2SScpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl",
  "orderSummary": {
    "items": [
      {
        "producto_id": 1,
        "cantidad": 2,
        "precio_unitario": "25.99",
        "subtotal": 51.98,
        "tps": 2.60,
        "tvq": 5.20,
        "consigne": 1.00
      }
    ],
    "subtotal": "51.98",
    "tps": "2.60",
    "tvq": "5.20", 
    "consigne": "1.00",
    "shippingCost": "9.99",
    "discount": "5.20",
    "total": "65.57",
    "coupon": {
      "codigo": "SAVE10",
      "descuento": 10
    },
    "shippingAddress": {
      "direccion": "123 Main St",
      "ciudad": "Montreal",
      "estado": "Quebec",
      "codigo_postal": "H1H 1H1",
      "pais": "Canada"
    }
  }
}
```

**Lo que haces con esto:**
```javascript
// 1. Llamar endpoint
const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/stripe/checkout/create-session`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    shipping_address_id: selectedAddressId,
    coupon_code: couponCode || undefined,
    success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${window.location.origin}/checkout/cancel`
  })
});

const data = await response.json();

// 2. Redirigir a Stripe
window.location.href = data.url; // ¡Eso es todo!
```

---

### 2. **Verificar Estado del Pago**
```
GET /api/v1/stripe/checkout/session-status/{sessionId}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Respuesta que recibes:**
```json
{
  "sessionId": "cs_test_b1x2RTdOuZpiceAxPkVBRkwOhghLcH58eaj6HJyYwOhaPJbJ1ltJp6mQLd",
  "status": "complete",
  "payment_status": "paid",
  "amount_total": 6557,
  "currency": "cad", 
  "customer_email": "usuario@email.com",
  "metadata": {
    "user_id": "123",
    "shipping_address_id": "456",
    "total": "65.57"
  },
  "order": {
    "id": 789,
    "estado": "pagado", 
    "total": 65.57,
    "fecha_pedido": "2024-01-15T10:30:00Z"
  }
}
```

**Lo que haces con esto:**
```javascript
// En tu página /checkout/success
const { session_id } = router.query;

const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/stripe/checkout/session-status/${session_id}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();

// Mostrar confirmación
if (data.order) {
  console.log('¡Pedido creado!', data.order.id);
}
```

---

## 💻 Código Frontend Completo

### **Botón de Checkout**
```tsx
const handleCheckout = async () => {
  try {
    setLoading(true);
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/stripe/checkout/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipping_address_id: selectedAddressId,
        coupon_code: couponCode || undefined,
        success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/checkout/cancel`
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error creando sesión');
    }

    // Redirigir a Stripe Checkout
    window.location.href = data.url;
    
  } catch (error) {
    setError(error.message);
    setLoading(false);
  }
};

return (
  <button onClick={handleCheckout} disabled={loading}>
    {loading ? 'Redirigiendo a Stripe...' : '💳 Pagar con Stripe'}
  </button>
);
```

### **Página Success**
```tsx
// pages/checkout/success.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function CheckoutSuccess() {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { session_id } = router.query;

  useEffect(() => {
    if (session_id) {
      fetchOrder();
    }
  }, [session_id]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/stripe/checkout/session-status/${session_id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setOrder(data.order);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Verificando pago...</div>;

  return (
    <div>
      <h1>¡Pago Exitoso! ✅</h1>
      {order && (
        <div>
          <h2>Pedido #{order.id}</h2>
          <p>Total: ${order.total.toFixed(2)} CAD</p>
          <p>Estado: {order.estado}</p>
        </div>
      )}
      <button onClick={() => router.push('/orders')}>
        Ver Mis Pedidos
      </button>
    </div>
  );
}
```

### **Página Cancel**
```tsx
// pages/checkout/cancel.tsx
export default function CheckoutCancel() {
  return (
    <div>
      <h1>Pago Cancelado ❌</h1>
      <p>Tu carrito sigue guardado</p>
      <button onClick={() => router.push('/cart')}>
        Volver al Carrito
      </button>
    </div>
  );
}
```

---

## 🔄 Flujo Automático (Sin tu intervención)

1. **Usuario paga en Stripe** → Stripe procesa automáticamente
2. **Webhook recibe evento** → `checkout.session.completed` 
3. **Backend crea orden automáticamente:**
   - Crea registro en `pedidos`
   - Crea detalles en `detalles_pedido`
   - Actualiza stock de productos
   - Limpia carrito del usuario
   - Envía emails de confirmación
4. **Usuario regresa a tu app** → Con `session_id` en URL
5. **Frontend verifica estado** → Llama `/session-status/{sessionId}`

**¡Tú no tienes que hacer nada!** El webhook maneja toda la lógica de crear la orden.

---

## 🛠️ Variables de Entorno

```env
# Frontend (.env.local)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RMfRYC09...
NEXT_PUBLIC_API_BASE_URL=https://backendtoutaunclicla-production.up.railway.app/api/v1
```

---

## 🎯 Resumen: Solo Necesitas

1. **Un botón** que llame `create-session` y haga `window.location.href = data.url`
2. **Una página success** que llame `session-status/{sessionId}` y muestre confirmación  
3. **Una página cancel** simple con botón para volver

**Eso es literalmente todo.** Stripe maneja el resto del proceso de pago.

---

## 🚨 Errores Comunes

**Error: "Invalid shipping address"**
→ Verifica que `shipping_address_id` existe en la BD

**Error: "Empty cart"**  
→ Verifica que el usuario tiene items en el carrito

**Error: "Unauthorized"**
→ Verifica que el JWT token es válido

**Error al obtener session status**
→ Verifica que el `session_id` es correcto y pertenece al usuario