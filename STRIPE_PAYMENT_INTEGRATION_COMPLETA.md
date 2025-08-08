# Guía Completa de Integración Stripe Checkout - ToutAunClicLa

## Descripción General

Esta guía proporciona instrucciones completas para implementar el sistema de pagos profesional con **Stripe Checkout** para el e-commerce ToutAunClicLa. El sistema utiliza Stripe Checkout Sessions que redirigen a una página de pago hosteada por Stripe, simplificando enormemente la implementación y mejorando la seguridad.

---

## 🔄 Nuevo Flujo de Usuario (Stripe Checkout)

### 1. **Registro y Gestión del Carrito** *(Sin cambios)*
```
📱 Usuario se registra y añade productos al carrito
↓
🛒 Carrito se almacena en la base de datos
↓
📍 Usuario selecciona/crea dirección de envío
↓
🎟️ Aplica cupón de descuento (opcional)
↓
💰 Sistema calcula totales con impuestos
```

### 2. **Nuevo Flujo de Pago con Stripe Checkout**
```
💳 Usuario hace clic en "Proceder al Pago"
↓
🔒 Backend crea Stripe Checkout Session
↓
📊 Session incluye todos los line items (productos, envío, impuestos)
↓
🌐 Usuario es redirigido a Stripe Checkout (stripe.com)
↓
💳 Usuario completa el pago en la página de Stripe
↓
✅ Stripe procesa el pago automáticamente
↓
🔔 Webhook notifica al backend cuando el pago es exitoso
↓
📝 Backend crea la orden automáticamente
↓
🔄 Usuario es redirigido a página de confirmación
```

### 3. **Ventajas del Nuevo Sistema**
- ✅ **Más Seguro**: PCI compliance manejado completamente por Stripe
- ✅ **Más Simple**: No necesidad de manejar elementos de pago en frontend
- ✅ **Mejor UX**: Página optimizada de Stripe con soporte multi-idioma
- ✅ **Móvil Optimizado**: Experiencia nativa en móviles
- ✅ **Métodos de Pago**: Apple Pay, Google Pay, Link automáticamente disponibles

---

## 🚀 Backend - Nuevos Endpoints API

### **1. Crear Checkout Session**
```http
POST /api/v1/stripe/checkout/create-session
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "shipping_address_id": "550e8400-e29b-41d4-a716-446655440000",
  "coupon_code": "SAVE10",
  "success_url": "https://miapp.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://miapp.com/checkout/cancel"
}
```

**Response Exitosa:**
```json
{
  "success": true,
  "sessionId": "cs_live_1234567890abcdef",
  "url": "https://checkout.stripe.com/c/pay/cs_live_1234567890abcdef#fidkdWxOYHwnPyd1blpxYHZxWjA0S2NfZ0tIYWpMcVJocnI2M2Y3fE5jNEpKZ3BdNlNOPHJVT3Y0S2pjM0B0anZNbEJzZjdnTmJGN09sRH1hZnFPNWd8bEtKbWl0YERHaGdPSzRLZG5IQERRcFJUfXFPZCcpJ3VpbGtuQH11anZgYUxhJz8ncWB2cVpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl",
  "orderSummary": {
    "items": [
      {
        "producto_id": 1,
        "nombre": "Producto Ejemplo",
        "cantidad": 2,
        "precio_unitario": 25.99,
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

### **2. Verificar Estado de Session**
```http
GET /api/v1/stripe/checkout/session-status/{sessionId}
Authorization: Bearer <jwt_token>
```

**Response Exitosa:**
```json
{
  "sessionId": "cs_live_1234567890abcdef",
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

### **3. Webhook Handler** *(Actualizado)*
```http
POST /api/v1/stripe/webhook
Content-Type: application/json
Stripe-Signature: t=timestamp,v1=signature
```

**Eventos Manejados:**
- `checkout.session.completed` - Crea orden automáticamente
- `checkout.session.expired` - Log sesión expirada
- `payment_intent.succeeded` - Confirma pago (backup)
- `payment_intent.payment_failed` - Maneja pagos fallidos

---

## 💻 Frontend - Implementación Simplificada

### **1. Instalación** *(Sin cambios)*
```bash
npm install @stripe/stripe-js
```

### **2. Configuración** *(Simplificada)*
```typescript
// lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
export default stripePromise;
```

### **3. Página de Checkout Simplificada**
```tsx
// pages/checkout.tsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useAddresses } from '../hooks/useAddresses';

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const { items } = useCart();
  const { addresses } = useAddresses();
  
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAddressId) {
      setError('Por favor selecciona una dirección de envío');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/v1/stripe/checkout/create-session', {
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
        throw new Error(data.message || 'Error creando sesión de checkout');
      }

      // Redirigir a Stripe Checkout
      window.location.href = data.url;

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) {
    return (
      <div className="empty-cart">
        <h2>Tu carrito está vacío</h2>
        <p>Añade productos para continuar</p>
      </div>
    );
  }

  return (
    <div className="checkout-container">
      <h1>Finalizar Compra</h1>
      
      <form onSubmit={handleCheckout}>
        {/* Resumen de productos */}
        <div className="order-summary">
          <h3>Productos ({items.length})</h3>
          {items.map(item => (
            <div key={item.id} className="checkout-item">
              <span>{item.nombre} x {item.cantidad}</span>
              <span>${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Selección de dirección */}
        <div className="shipping-section">
          <h3>Dirección de Envío</h3>
          <select 
            value={selectedAddressId} 
            onChange={(e) => setSelectedAddressId(e.target.value)}
            required
          >
            <option value="">Selecciona una dirección</option>
            {addresses.map(addr => (
              <option key={addr.id} value={addr.id}>
                {addr.direccion}, {addr.ciudad}, {addr.estado}
              </option>
            ))}
          </select>
        </div>

        {/* Cupón */}
        <div className="coupon-section">
          <h3>Código de Cupón (Opcional)</h3>
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Ingresa código de cupón"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Botón de checkout */}
        <button 
          type="submit" 
          disabled={loading || !selectedAddressId}
          className="checkout-button"
        >
          {loading ? 'Preparando pago...' : 'Proceder al Pago'}
        </button>
      </form>

      <div className="security-note">
        🔒 Pago seguro procesado por Stripe
      </div>
    </div>
  );
}
```

### **4. Página de Éxito**
```tsx
// pages/checkout/success.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { session_id } = router.query;

  useEffect(() => {
    if (session_id && token) {
      fetchOrderStatus();
    }
  }, [session_id, token]);

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch(`/api/v1/stripe/checkout/session-status/${session_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.order) {
        setOrder(data.order);
      }
    } catch (error) {
      console.error('Error fetching order status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Verificando tu pedido...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="error-container">
        <h2>Error procesando tu pedido</h2>
        <p>Por favor contacta a soporte si el problema persiste.</p>
      </div>
    );
  }

  return (
    <div className="success-container">
      <div className="success-icon">✅</div>
      <h1>¡Pago Exitoso!</h1>
      <h2>Pedido #{order.id}</h2>
      
      <div className="order-details">
        <p><strong>Total:</strong> ${order.total.toFixed(2)} CAD</p>
        <p><strong>Estado:</strong> {order.estado}</p>
        <p><strong>Fecha:</strong> {new Date(order.fecha_pedido).toLocaleDateString()}</p>
      </div>

      <div className="next-steps">
        <h3>¿Qué sigue?</h3>
        <ul>
          <li>Recibirás un email de confirmación en breve</li>
          <li>Te notificaremos cuando tu pedido sea enviado</li>
          <li>Puedes rastrear tu pedido en tu perfil</li>
        </ul>
      </div>

      <div className="actions">
        <button 
          onClick={() => router.push('/orders')}
          className="primary-button"
        >
          Ver Mis Pedidos
        </button>
        <button 
          onClick={() => router.push('/products')}
          className="secondary-button"
        >
          Continuar Comprando
        </button>
      </div>
    </div>
  );
}
```

### **5. Página de Cancelación**
```tsx
// pages/checkout/cancel.tsx
import React from 'react';
import { useRouter } from 'next/router';

export default function CheckoutCancelPage() {
  const router = useRouter();

  return (
    <div className="cancel-container">
      <div className="cancel-icon">❌</div>
      <h1>Pago Cancelado</h1>
      <p>No te preocupes, tu carrito sigue guardado.</p>
      
      <div className="actions">
        <button 
          onClick={() => router.push('/cart')}
          className="primary-button"
        >
          Volver al Carrito
        </button>
        <button 
          onClick={() => router.push('/products')}
          className="secondary-button"
        >
          Continuar Comprando
        </button>
      </div>
    </div>
  );
}
```

---

## 🎯 Pasos de Implementación Paso a Paso

### **Paso 1: Backend Setup**
1. **Actualizar variables de entorno**:
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_51RMfRYC09...
STRIPE_PUBLISHABLE_KEY=pk_test_51RMfRYC09...
STRIPE_WEBHOOK_SECRET=whsec_KXmKY0Y6O8...

# Frontend URLs
FRONTEND_URL=http://localhost:3000
```

2. **Crear/Actualizar tabla de pedidos** (si no existe):
```sql
ALTER TABLE pedidos 
ADD COLUMN stripe_checkout_session_id TEXT,
ADD COLUMN fecha_pago TIMESTAMP;

-- Agregar índice para performance
CREATE INDEX idx_pedidos_checkout_session 
ON pedidos(stripe_checkout_session_id);
```

3. **Actualizar tabla de logs de pago**:
```sql
ALTER TABLE payment_logs 
ADD COLUMN stripe_checkout_session_id TEXT;
```

### **Paso 2: Frontend Setup**
1. **Instalar dependencias**:
```bash
npm install @stripe/stripe-js
```

2. **Configurar variables de entorno**:
```env
# .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RMfRYC09...
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

3. **Crear páginas requeridas**:
   - `/checkout` - Página principal de checkout
   - `/checkout/success` - Confirmación de pago
   - `/checkout/cancel` - Pago cancelado

### **Paso 3: Stripe Dashboard Configuration**
1. **Configurar Webhook**:
   - URL: `https://tu-dominio.com/api/v1/stripe/webhook`
   - Eventos:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

2. **Configurar Return URLs en el Dashboard**:
   - Success URL: `https://tu-dominio.com/checkout/success?session_id={CHECKOUT_SESSION_ID}`
   - Cancel URL: `https://tu-dominio.com/checkout/cancel`

### **Paso 4: Testing**
1. **Test con tarjetas de Stripe**:
   - Éxito: `4242 4242 4242 4242`
   - Declinada: `4000 0000 0000 0002`

2. **Verificar flujo completo**:
   - Añadir productos al carrito
   - Proceder al checkout
   - Completar pago en Stripe
   - Verificar creación de orden
   - Confirmar emails enviados

### **Paso 5: Deployment**
1. **Configurar variables de producción**
2. **Activar modo live en Stripe**
3. **Configurar HTTPS (requerido para webhooks)**
4. **Configurar monitoreo de errores**

---

## 🔧 Variables de Entorno Completas

### **Backend (.env)**
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_51RMfRYC09...
STRIPE_PUBLISHABLE_KEY=pk_live_51RMfRYC09...
STRIPE_WEBHOOK_SECRET=whsec_KXmKY0Y6O8...

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Service
RESEND_API_KEY=re_your-api-key

# Application
JWT_SECRET=your-jwt-secret-key
FRONTEND_URL=https://toutaunclicla.com
ADMIN_EMAILS=admin@toutaunclicla.com

# Environment
NODE_ENV=production
PORT=5000
```

### **Frontend (.env.local)**
```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51RMfRYC09...

# API
NEXT_PUBLIC_API_URL=https://api.toutaunclicla.com/api/v1

# Google Maps (opcional para auto-complete de direcciones)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=GA-XXXXXXXXX
```

---

## 📱 Responsive Design y Mobile

### **CSS para Checkout Móvil**
```css
/* styles/checkout.css */
.checkout-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
}

.checkout-button {
  width: 100%;
  padding: 1rem;
  font-size: 1.2rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 1rem;
}

.checkout-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.security-note {
  text-align: center;
  margin-top: 1rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #666;
}

@media (max-width: 768px) {
  .checkout-container {
    padding: 0.5rem;
  }
  
  .checkout-button {
    padding: 1.25rem;
    font-size: 1.1rem;
  }
}
```

---

## 🧪 Testing y Debugging

### **Tarjetas de Prueba Stripe**
```javascript
// Pagos exitosos
'4242424242424242'  // Visa básica
'4000002500003155'  // Visa (requiere CVC)
'5555555555554444'  // Mastercard

// Pagos que fallan
'4000000000000002'  // Tarjeta declinada
'4000000000000069'  // Tarjeta expirada
'4000000000000119'  // Procesamiento fallido

// Pagos que requieren autenticación
'4000002760003184'  // 3D Secure 2
'4000003800000446'  // 3D Secure requerido
```

### **Debug Webhook en Desarrollo**
```bash
# Instalar Stripe CLI
stripe login

# Forward webhooks a localhost
stripe listen --forward-to localhost:5000/api/v1/stripe/webhook

# Usar webhook secret que aparece en consola
# whsec_1234567890abcdef...
```

### **Logs para Debug**
```javascript
// En stripeController.js
console.log('Checkout session created:', {
  sessionId: session.id,
  userId: userId,
  total: totalAmount,
  items: cartItems.length
});

// En webhook handler
console.log('Webhook received:', {
  type: event.type,
  sessionId: event.data.object.id,
  status: event.data.object.status
});
```

---

## 🚨 Errores Comunes y Soluciones

### **Error: "Invalid shipping address"**
**Solución:** Verificar que `shipping_address_id` existe y pertenece al usuario.

### **Error: "Empty cart"**
**Solución:** Verificar que el carrito tiene items antes de crear la session.

### **Error: "Webhook signature verification failed"**
**Solución:** Verificar que `STRIPE_WEBHOOK_SECRET` es correcto y usar `express.raw()` para el endpoint.

### **Error: "Session not found"**
**Solución:** Verificar que el `session_id` es válido y no ha expirado.

---

## 🔐 Seguridad y Compliance

### **PCI Compliance**
- ✅ **Automático**: Stripe maneja toda la información de tarjetas
- ✅ **No storage**: Nunca almacenes datos de tarjetas en tu servidor
- ✅ **HTTPS**: Siempre usa HTTPS en producción

### **Validaciones de Seguridad**
```javascript
// Validar ownership de session
if (session.metadata.user_id !== userId) {
  return res.status(403).json({
    error: 'Unauthorized access to checkout session'
  });
}

// Validar webhook signature
try {
  event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
} catch (err) {
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
```

---

## 📊 Monitoreo y Analytics

### **Métricas Importantes**
```javascript
// Conversión de checkout
const conversionRate = completedSessions / createdSessions;

// Tiempo promedio de checkout
const avgCheckoutTime = totalCheckoutTime / completedSessions;

// Abandono por step
const abandonmentByStep = {
  addressSelection: addressAbandons / totalStarts,
  paymentPage: paymentAbandons / paymentStarts
};
```

### **Stripe Dashboard Monitoring**
- Monitor payment success rates
- Track failed payments and reasons
- Set up alerts for unusual activity
- Review dispute and chargeback data

---

## ✅ Checklist de Implementación

### **Backend**
- [x] ✅ Endpoint `POST /checkout/create-session` implementado
- [x] ✅ Endpoint `GET /checkout/session-status/:id` implementado
- [x] ✅ Webhook handler actualizado para checkout events
- [x] ✅ Función `createOrderFromCheckoutSession` implementada
- [x] ✅ Variables de entorno configuradas
- [ ] Testing de todos los endpoints
- [ ] Validación de errores implementada
- [ ] Logging detallado agregado

### **Frontend**
- [ ] Página de checkout simplificada
- [ ] Página de éxito implementada
- [ ] Página de cancelación implementada
- [ ] Manejo de errores implementado
- [ ] Estados de carga implementados
- [ ] Testing end-to-end

### **Stripe Dashboard**
- [ ] Webhook configurado correctamente
- [ ] Eventos seleccionados apropiadamente
- [ ] Return URLs configuradas
- [ ] Métodos de pago habilitados
- [ ] Testing con tarjetas de prueba

### **Deployment**
- [ ] Variables de entorno en producción
- [ ] HTTPS configurado
- [ ] Stripe modo live activado
- [ ] Monitoreo configurado
- [ ] Backup de base de datos

---

Este nuevo flujo con **Stripe Checkout** simplifica enormemente la implementación mientras mejora la seguridad y experiencia del usuario. El frontend se reduce significativamente ya que Stripe maneja toda la interfaz de pago, y el backend simplemente crea sessions y maneja webhooks para crear órdenes automáticamente.