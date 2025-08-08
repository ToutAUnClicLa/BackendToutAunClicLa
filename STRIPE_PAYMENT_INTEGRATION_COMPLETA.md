# Guía Completa de Integración Stripe - ToutAunClicLa

## Descripción General

Esta guía proporciona instrucciones completas para implementar el sistema de pagos profesional de Stripe para el checkout del carrito en la aplicación e-commerce ToutAunClicLa.

---

## 🔄 Flujo Completo del Usuario (De Registro a Confirmación)

### 1. **Registro y Autenticación**
```
📱 Usuario accede a la aplicación
↓
🆕 Se registra con email/password o Google OAuth
↓
📧 Recibe email de verificación (opcional)
↓
✅ Confirma cuenta y obtiene JWT token
↓
🔐 Token se almacena en localStorage/cookies para futuras requests
```

### 2. **Navegación y Selección de Productos**
```
🛍️ Usuario navega el catálogo
↓
🔍 Busca/filtra productos
↓
👆 Selecciona producto y cantidad
↓
🛒 Añade al carrito (POST /api/v1/cart)
↓
💾 Producto se guarda en base de datos asociado al usuario
↓
🔄 Proceso se repite para múltiples productos
```

### 3. **Gestión del Carrito**
```
🛒 Usuario revisa carrito
↓
📝 Puede modificar cantidades (PUT /api/v1/cart/:id)
↓
🗑️ Puede eliminar productos (DELETE /api/v1/cart/:id)
↓
💰 Sistema calcula subtotales en tiempo real
↓
🎯 Usuario procede al checkout
```

### 4. **Configuración de Dirección de Envío**
```
📍 Usuario selecciona dirección existente o crea nueva
↓
✅ Sistema valida dirección
↓
💾 Dirección se guarda/actualiza en base de datos
↓
📦 Sistema calcula costo de envío basado en ubicación
```

### 5. **Aplicación de Cupón (Opcional)**
```
🎟️ Usuario ingresa código de cupón
↓
✅ Sistema valida cupón (vigencia, uso previo)
↓
💰 Descuento se aplica al total
↓
💾 Cupón se marca como usado
```

### 6. **Inicialización del Pago**
```
💳 Usuario confirma checkout
↓
🔒 Sistema crea Payment Intent con Stripe
↓
🧮 Calcula totales (subtotal + TPS + TVQ + envío - descuentos)
↓
🔑 Retorna clientSecret al frontend
↓
📱 Frontend inicializa Stripe Elements
```

### 7. **Procesamiento del Pago**
```
💳 Usuario ingresa datos de tarjeta
↓
🔒 Stripe valida información
↓
🌐 Se procesa pago (puede requerir 3D Secure)
↓
✅ Payment Intent se marca como "succeeded"
↓
📨 Webhook notifica al backend
```

### 8. **Creación de Orden**
```
✅ Backend recibe confirmación de pago exitoso
↓
📝 Crea orden en tabla 'pedidos'
↓
📋 Crea detalles en tabla 'detalles_pedido'
↓
📦 Actualiza stock de productos
↓
🗑️ Limpia carrito del usuario
↓
📧 Programa envío de emails
```

### 9. **Confirmación y Notificaciones**
```
📧 Cliente recibe email de confirmación con:
   - Detalles de la orden
   - Breakdown de impuestos
   - Información de envío
   - PDF del recibo (opcional)
↓
📨 Administradores reciben notificación de nueva orden
↓
📱 Usuario ve confirmación en pantalla
↓
📋 Usuario puede acceder a historial de órdenes
```

---

## 🚀 Backend - Endpoints API Implementados

### **1. Crear Payment Intent desde Carrito**
```http
POST /api/v1/stripe/checkout/payment-intent
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "shipping_address_id": "550e8400-e29b-41d4-a716-446655440000",
  "coupon_code": "SAVE10"
}
```

**Response Exitosa:**
```json
{
  "success": true,
  "clientSecret": "pi_3OH7MsC09Hbp0X9k1ABCDEfg_secret_xyz123",
  "paymentIntentId": "pi_3OH7MsC09Hbp0X9k1ABCDEfg",
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

### **2. Confirmar Pago y Crear Orden**
```http
POST /api/v1/stripe/checkout/confirm
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_3OH7MsC09Hbp0X9k1ABCDEfg"
}
```

**Response Exitosa:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "id": 123,
    "total": 65.57,
    "status": "confirmado",
    "created_at": "2024-01-15T10:30:00Z",
    "tracking_number": null
  },
  "paymentStatus": "succeeded"
}
```

### **3. Obtener Estado del Pago**
```http
GET /api/v1/stripe/payment-status/{paymentIntentId}
Authorization: Bearer <jwt_token>
```

### **4. Crear Reembolso**
```http
POST /api/v1/stripe/refund
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_3OH7MsC09Hbp0X9k1ABCDEfg",
  "amount": 25.99,
  "reason": "requested_by_customer"
}
```

### **5. Gestión de Métodos de Pago**
```http
GET /api/v1/stripe/payment-methods
POST /api/v1/stripe/payment-methods
DELETE /api/v1/stripe/payment-methods/{paymentMethodId}
```

---

## 💻 Frontend - Implementación Completa

### **1. Instalación de Dependencias**
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### **2. Configuración de Stripe**
```typescript
// lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
export default stripePromise;
```

### **3. Contexto de Carrito (Ejemplo)**
```typescript
// contexts/CartContext.tsx
import { createContext, useContext, useReducer } from 'react';

interface CartItem {
  id: string;
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen_principal: string;
}

interface CartContextType {
  items: CartItem[];
  total: number;
  addToCart: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  // Implementación del reducer y funciones
  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};
```

### **4. Hook Personalizado para Carrito**
```typescript
// hooks/useCart.ts
import { useContext } from 'react';
import { CartContext } from '../contexts/CartContext';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
};
```

### **5. Página de Checkout Completa**
```tsx
// pages/checkout.tsx
import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from '../lib/stripe';
import CheckoutForm from '../components/CheckoutForm';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const { items } = useCart();
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!items.length) {
      // Redirigir si el carrito está vacío
      return;
    }
    
    createPaymentIntent();
  }, [items]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/v1/stripe/checkout/payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shipping_address_id: selectedAddressId,
          coupon_code: couponCode || undefined
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error creating payment intent');
      }

      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#667eea',
    },
  };

  const options = {
    clientSecret,
    appearance,
  };

  if (loading) return <div>Cargando checkout...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="checkout-container">
      <h1>Finalizar Compra</h1>
      
      {clientSecret && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      )}
    </div>
  );
}
```

### **6. Formulario de Checkout**
```tsx
// components/CheckoutForm.tsx
import React, { useState } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  AddressElement
} from '@stripe/react-stripe-js';
import { useAuth } from '../hooks/useAuth';

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    // Confirmar pago con Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message || 'Error procesando el pago');
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Confirmar orden en el backend
      try {
        const response = await fetch('/api/v1/stripe/checkout/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          // Redirigir a página de éxito
          window.location.href = `/order-confirmation/${data.order.id}`;
        } else {
          throw new Error(data.message);
        }
      } catch (err) {
        setMessage('Error confirmando la orden: ' + err.message);
      }
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" />
      <AddressElement 
        options={{
          mode: 'shipping',
          allowedCountries: ['CA']
        }}
      />
      
      <button 
        disabled={isLoading || !stripe || !elements} 
        id="submit"
        className="checkout-button"
      >
        {isLoading ? 'Procesando...' : 'Pagar Ahora'}
      </button>
      
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
}
```

### **7. Componente de Carrito**
```tsx
// components/Cart.tsx
import React from 'react';
import { useCart } from '../hooks/useCart';
import CartItem from './CartItem';

export default function Cart() {
  const { items, total, clearCart } = useCart();

  if (!items.length) {
    return (
      <div className="empty-cart">
        <h2>Tu carrito está vacío</h2>
        <p>¡Añade algunos productos para comenzar!</p>
      </div>
    );
  }

  return (
    <div className="cart">
      <h2>Carrito de Compras ({items.length} productos)</h2>
      
      <div className="cart-items">
        {items.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
      
      <div className="cart-summary">
        <div className="cart-total">
          <h3>Total: ${total.toFixed(2)} CAD</h3>
        </div>
        
        <div className="cart-actions">
          <button onClick={clearCart} className="clear-button">
            Vaciar Carrito
          </button>
          <button 
            onClick={() => window.location.href = '/checkout'} 
            className="checkout-button"
          >
            Proceder al Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
```

### **8. Hook para Direcciones**
```typescript
// hooks/useAddresses.ts
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface Address {
  id: string;
  direccion: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais: string;
  es_predeterminada: boolean;
}

export const useAddresses = () => {
  const { token } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = async () => {
    try {
      const response = await fetch('/api/v1/addresses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setAddresses(data.addresses || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAddress = async (addressData: Omit<Address, 'id'>) => {
    try {
      const response = await fetch('/api/v1/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(addressData)
      });

      const data = await response.json();
      
      if (response.ok) {
        await fetchAddresses(); // Refrescar lista
        return data.address;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    if (token) {
      fetchAddresses();
    }
  }, [token]);

  return {
    addresses,
    loading,
    createAddress,
    refetch: fetchAddresses
  };
};
```

---

## 🎯 Mejores Prácticas y Recomendaciones

### **Frontend**

#### ✅ Seguridad
```typescript
// ❌ NUNCA hagas esto
const STRIPE_SECRET_KEY = 'sk_test_...'; // NUNCA en frontend

// ✅ Usa solo la clave pública
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
```

#### ✅ Gestión de Estados
```typescript
// Usa estados de carga apropiados
const [isProcessing, setIsProcessing] = useState(false);
const [paymentError, setPaymentError] = useState('');
const [paymentSuccess, setPaymentSuccess] = useState(false);
```

#### ✅ Validación de Formularios
```typescript
// Valida datos antes de enviar
const validateCheckoutData = (data) => {
  if (!data.shipping_address_id) {
    throw new Error('Dirección de envío requerida');
  }
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Carrito vacío');
  }
};
```

#### ✅ Manejo de Errores
```typescript
// Maneja diferentes tipos de errores de Stripe
const handlePaymentError = (error) => {
  switch (error.type) {
    case 'card_error':
      return 'Tu tarjeta fue rechazada. ' + error.message;
    case 'rate_limit_error':
      return 'Demasiadas solicitudes. Por favor intenta más tarde.';
    case 'invalid_request_error':
      return 'Solicitud inválida. Por favor contacta soporte.';
    default:
      return 'Error inesperado. Por favor intenta nuevamente.';
  }
};
```

### **Backend**

#### ✅ Validación de Stock
```javascript
// Siempre valida stock antes de procesar pago
const validateStock = async (cartItems) => {
  for (const item of cartItems) {
    if (item.productos.stock < item.cantidad) {
      throw new Error(`Stock insuficiente para ${item.productos.nombre}`);
    }
  }
};
```

#### ✅ Transacciones Atómicas
```javascript
// Usa transacciones para operaciones críticas
const processOrder = async (paymentIntentId) => {
  const { data, error } = await supabaseAdmin.rpc('process_order_transaction', {
    payment_intent_id: paymentIntentId,
    user_id: userId
  });
  
  if (error) throw error;
  return data;
};
```

#### ✅ Logging Detallado
```javascript
// Log todas las operaciones importantes
console.log(`Payment intent created: ${paymentIntent.id} for user: ${userId}`);
console.log(`Order created: ${order.id} with total: ${order.total}`);
console.log(`Email sent to: ${user.correo_electronico}`);
```

---

## 🔧 Variables de Entorno Requeridas

### **Backend (.env)**
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51RMfRYC09...
STRIPE_PUBLISHABLE_KEY=pk_test_51RMfRYC09...
STRIPE_WEBHOOK_SECRET=whsec_KXmKY0Y6O8...

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Service
RESEND_API_KEY=re_your-api-key

# Application
JWT_SECRET=your-jwt-secret
FRONTEND_URL=https://toutaunclicla.com
ADMIN_EMAILS=admin@toutaunclicla.com
```

### **Frontend (.env.local)**
```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RMfRYC09...

# API
NEXT_PUBLIC_API_URL=https://api.toutaunclicla.com/api/v1

# Google Analytics (opcional)
NEXT_PUBLIC_GA_ID=GA-XXXXXXXXX
```

---

## 🧪 Testing Completo

### **Tarjetas de Prueba Stripe**
```javascript
// Éxito
4242 4242 4242 4242

// Declinada
4000 0000 0000 0002

// Fondos insuficientes
4000 0000 0000 9995

// 3D Secure requerido
4000 0000 0000 3220

// Expirada
4000 0000 0000 0069

// CVV incorrecto
4000 0000 0000 0127
```

### **Flujo de Testing Recomendado**
```javascript
// 1. Test de carrito básico
test('añadir producto al carrito', async () => {
  // Implementar test
});

// 2. Test de cálculo de impuestos
test('calcular impuestos Quebec correctamente', async () => {
  // Implementar test
});

// 3. Test de checkout completo
test('flujo completo de checkout', async () => {
  // Implementar test end-to-end
});

// 4. Test de webhook
test('procesar webhook de pago exitoso', async () => {
  // Implementar test de webhook
});
```

---

## 📊 Monitoreo y Métricas

### **Métricas Importantes a Monitorear**
```javascript
// 1. Tasa de éxito de pagos
const paymentSuccessRate = successfulPayments / totalPaymentAttempts;

// 2. Abandono de carrito
const cartAbandonmentRate = (cartsCreated - ordersCompleted) / cartsCreated;

// 3. Valor promedio de orden
const averageOrderValue = totalRevenue / totalOrders;

// 4. Tiempo promedio de checkout
const averageCheckoutTime = totalCheckoutTime / completedCheckouts;
```

### **Dashboard de Stripe**
- Monitorea pagos fallidos
- Revisa disputas y chargebacks
- Analiza patrones de fraude
- Configura alertas automáticas

---

## 🚨 Manejo de Errores Avanzado

### **Frontend Error Boundary**
```tsx
// components/ErrorBoundary.tsx
import React from 'react';

class CheckoutErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to monitoring service
    console.error('Checkout error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="checkout-error">
          <h2>Oops! Algo salió mal</h2>
          <p>Por favor recarga la página o contacta soporte.</p>
          <button onClick={() => window.location.reload()}>
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 🔐 Configuración de Stripe Dashboard

### **1. Configuración de Cuenta**
1. Crear cuenta en https://dashboard.stripe.com
2. Verificar información del negocio
3. Configurar detalles bancarios
4. Activar modo en vivo cuando esté listo

### **2. Configuración de Webhooks**
1. Ir a **Developers** > **Webhooks**
2. Añadir endpoint: `https://tu-dominio.com/api/v1/stripe/webhook`
3. Seleccionar eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.requires_action`
   - `payment_intent.canceled`
4. Copiar el **Signing secret**

### **3. Configuración de Métodos de Pago**
1. Ir a **Settings** > **Payment methods**
2. Habilitar métodos deseados:
   - Tarjetas de crédito/débito
   - Apple Pay
   - Google Pay
   - Bancontact (para EU)

### **4. Configuración de Radar (Antifraude)**
1. Ir a **Radar** > **Rules**
2. Configurar reglas de riesgo:
   - Bloquear pagos de ciertos países
   - Limitar intentos por IP
   - Verificar CVV y código postal

---

## 📈 Optimización de Conversión

### **1. Optimización de UX**
```tsx
// Mostrar progreso del checkout
<div className="checkout-progress">
  <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
    1. Información
  </div>
  <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
    2. Envío
  </div>
  <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
    3. Pago
  </div>
</div>

// Mostrar resumen de orden siempre visible
<div className="order-summary-sticky">
  <h3>Resumen de Orden</h3>
  <div>Subtotal: ${subtotal}</div>
  <div>Impuestos: ${taxes}</div>
  <div>Envío: ${shipping}</div>
  <div className="total">Total: ${total}</div>
</div>
```

### **2. Reducir Fricción**
```tsx
// Auto-complete de direcciones
<AddressElement 
  options={{
    mode: 'shipping',
    allowedCountries: ['CA'],
    autocomplete: {
      mode: 'google_maps_api',
      apiKey: process.env.GOOGLE_MAPS_API_KEY
    }
  }}
/>

// Guardar métodos de pago para futuros usos
<PaymentElement 
  options={{
    setupFutureUsage: 'on_session'
  }}
/>
```

### **3. Confianza y Seguridad**
```tsx
// Mostrar badges de seguridad
<div className="security-badges">
  <img src="/ssl-secure.png" alt="SSL Secure" />
  <img src="/stripe-powered.png" alt="Powered by Stripe" />
  <div>🔒 Pago 100% seguro</div>
</div>

// Política de reembolso visible
<div className="refund-policy">
  <p>💰 Reembolso completo disponible por 30 días</p>
</div>
```

---

## 📱 Responsive Design Considerations

### **Mobile-First Checkout**
```css
/* styles/checkout.css */
.checkout-container {
  padding: 1rem;
  max-width: 100%;
}

@media (min-width: 768px) {
  .checkout-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .checkout-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 2rem;
  }
}

.payment-element {
  /* Stripe Elements se adaptan automáticamente */
  margin: 1rem 0;
}

.checkout-button {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.checkout-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

## 🔄 Manejo de Estados de Conexión

```tsx
// hooks/useOnlineStatus.ts
import { useState, useEffect } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// En el componente de checkout
const CheckoutForm = () => {
  const isOnline = useOnlineStatus();
  
  if (!isOnline) {
    return (
      <div className="offline-message">
        <p>⚠️ Sin conexión a internet</p>
        <p>Por favor verifica tu conexión para continuar.</p>
      </div>
    );
  }
  
  // ... resto del componente
};
```

---

## 📋 Checklist de Implementación

### **Backend**
- [ ] ✅ Configurar variables de entorno
- [ ] ✅ Implementar endpoints de Stripe
- [ ] ✅ Configurar webhooks
- [ ] ✅ Implementar envío de emails
- [ ] ✅ Agregar logging detallado
- [ ] ✅ Configurar manejo de errores
- [ ] ✅ Implementar validaciones
- [ ] ✅ Testing de endpoints

### **Frontend**
- [ ] Instalar dependencias de Stripe
- [ ] Configurar Stripe Elements
- [ ] Implementar flujo de checkout
- [ ] Añadir manejo de errores
- [ ] Implementar estados de carga
- [ ] Optimizar para móvil
- [ ] Testing end-to-end
- [ ] Optimización de performance

### **Stripe Dashboard**
- [ ] Configurar cuenta
- [ ] Activar métodos de pago
- [ ] Configurar webhooks
- [ ] Configurar Radar
- [ ] Testing con tarjetas de prueba
- [ ] Activar modo en vivo

### **Producción**
- [ ] SSL configurado
- [ ] Variables de entorno en vivo
- [ ] Monitoreo configurado
- [ ] Backup de base de datos
- [ ] Políticas de privacidad
- [ ] Términos de servicio

---

Esta guía proporciona una implementación completa y profesional del sistema de pagos con Stripe para ToutAunClicLa, cubriendo desde el registro del usuario hasta la confirmación del pedido por email.
