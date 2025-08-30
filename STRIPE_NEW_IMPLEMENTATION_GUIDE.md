# 🚀 Guía de Implementación - Nuevo Stripe con Promociones

## 📋 Resumen de Cambios

### **Backend (Ya Implementado)**
✅ Promoción automática Maison de Poulet en Riviera Sur  
✅ Nuevos campos en respuestas de API  
✅ Integración completa con Stripe Checkout  
✅ Logs detallados de promociones  

### **Frontend (Para Implementar)**
🔄 Actualizar interfaces TypeScript  
🔄 Implementar nuevos hooks  
🔄 Crear componentes con soporte de promociones  
🔄 Agregar estilos visuales  

---

## 🎯 1. Campos Nuevos en la API

### **Respuesta del Carrito (`/api/v1/cart`)**
```json
{
  "summary": {
    "shippingCost": 0,                    // ✨ Precio final (0 si hay promoción)
    "originalShippingCost": 10,           // ✨ NUEVO - Precio original sin promoción
    "shippingDiscount": 10,               // ✨ NUEVO - Descuento aplicado
    "shippingMessage": "Descuento en envío...", // ✨ NUEVO - Mensaje de promoción
    "promotionApplied": true,             // ✨ NUEVO - Promoción activa
    "total": 29.88
  }
}
```

### **Respuesta de Checkout (`/api/v1/stripe/checkout/create-session`)**
```json
{
  "orderSummary": {
    "originalShippingCost": "10.00",      // ✨ NUEVO
    "shippingCost": "0.00",              // ✨ Precio final
    "shippingDiscount": "10.00",         // ✨ NUEVO - Descuento
    "promotionApplied": true,            // ✨ NUEVO
    "savings": "10.00",                  // ✨ ACTUALIZADO - Incluye descuentos de envío
    "total": "29.88"
  }
}
```

---

## 🎨 2. Interfaces TypeScript (Actualizar)

```typescript
// types/cart.ts
interface CartSummary {
  // Campos existentes...
  shippingCost: number;
  
  // ✨ NUEVOS CAMPOS
  originalShippingCost: number;    // Costo sin promoción
  shippingDiscount: number;        // Descuento aplicado
  shippingMessage?: string;        // Mensaje de promoción
  promotionApplied: boolean;       // Si hay promoción activa
  
  // Resto de campos...
  total: number;
}

interface StripeOrderSummary {
  // Campos existentes...
  shippingCost: string;
  
  // ✨ NUEVOS CAMPOS
  originalShippingCost: string;
  shippingDiscount: string;
  promotionApplied: boolean;
  
  // Campo actualizado
  savings: string;                 // Ahora incluye descuentos de envío
  
  // Resto de campos...
  total: string;
}
```

---

## 🪝 3. Hook de Carrito (useCart)

### **Implementación Completa**
```typescript
// hooks/useCart.ts
import { useState, useEffect, useCallback } from 'react';

interface CartHookReturn {
  cart: CartResponse | null;
  loading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  
  // ✨ NUEVAS FUNCIONES DE PROMOCIÓN
  hasMaisonPouletPromotion: () => boolean;
  getPromotionDetails: () => PromotionDetails | null;
  getTotalSavings: () => number;
  getShippingStatus: () => ShippingStatus;
}

interface PromotionDetails {
  isActive: boolean;
  discount: number;
  originalCost: number;
  message: string;
  type: 'maison_poulet_riviera';
}

interface ShippingStatus {
  isFree: boolean;
  cost: number;
  hasPromotion: boolean;
  hasThresholdFree: boolean; // $200+ pedidos
  message?: string;
}

export const useCart = (): CartHookReturn => {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/cart', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch cart');
      
      const data = await response.json();
      setCart(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading cart');
    } finally {
      setLoading(false);
    }
  }, []);

  // ✨ NUEVA FUNCIÓN - Detectar promoción Maison de Poulet
  const hasMaisonPouletPromotion = useCallback((): boolean => {
    return Boolean(
      cart?.summary?.promotionApplied && 
      cart?.summary?.shippingDiscount > 0
    );
  }, [cart]);

  // ✨ NUEVA FUNCIÓN - Detalles de la promoción
  const getPromotionDetails = useCallback((): PromotionDetails | null => {
    if (!hasMaisonPouletPromotion()) return null;
    
    return {
      isActive: true,
      discount: cart?.summary?.shippingDiscount || 0,
      originalCost: cart?.summary?.originalShippingCost || 0,
      message: cart?.summary?.shippingMessage || 'Promoción Maison de Poulet',
      type: 'maison_poulet_riviera'
    };
  }, [cart, hasMaisonPouletPromotion]);

  // ✨ NUEVA FUNCIÓN - Ahorros totales
  const getTotalSavings = useCallback((): number => {
    const shippingDiscount = cart?.summary?.shippingDiscount || 0;
    const couponDiscount = cart?.summary?.discountAmount || 0;
    return shippingDiscount + couponDiscount;
  }, [cart]);

  // ✨ NUEVA FUNCIÓN - Estado del envío
  const getShippingStatus = useCallback((): ShippingStatus => {
    const summary = cart?.summary;
    if (!summary) {
      return { isFree: false, cost: 0, hasPromotion: false, hasThresholdFree: false };
    }

    const isFree = summary.shippingCost === 0;
    const hasPromotion = Boolean(summary.promotionApplied);
    const hasThresholdFree = summary.subtotal >= (summary.shippingThreshold || 200);

    return {
      isFree,
      cost: summary.shippingCost,
      hasPromotion,
      hasThresholdFree,
      message: summary.shippingMessage
    };
  }, [cart]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return {
    cart,
    loading,
    error,
    fetchCart,
    hasMaisonPouletPromotion,
    getPromotionDetails,
    getTotalSavings,
    getShippingStatus
  };
};
```

---

## 🛒 4. Hook de Stripe Checkout (useStripeCheckout)

```typescript
// hooks/useStripeCheckout.ts
import { useState, useCallback } from 'react';

interface CheckoutParams {
  addressId: string;
  couponCode?: string;
}

interface CheckoutResult {
  success: boolean;
  data?: StripeCheckoutResponse;
  error?: string;
}

export const useStripeCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = useCallback(async (params: CheckoutParams): Promise<CheckoutResult> => {
    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Creating checkout session...', params);
      
      const response = await fetch('/api/v1/stripe/checkout/create-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shipping_address_id: params.addressId,
          coupon_code: params.couponCode || '',
          success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/checkout/cancel`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data: StripeCheckoutResponse = await response.json();
      
      console.log('✅ Checkout session created:', data.sessionId);

      // ✨ NUEVO - Log específico para promociones
      if (data.orderSummary.promotionApplied) {
        console.log('🎉 Promotion detected in checkout!', {
          originalShipping: data.orderSummary.originalShippingCost,
          finalShipping: data.orderSummary.shippingCost,
          discount: data.orderSummary.shippingDiscount,
          totalSavings: data.orderSummary.savings
        });
      }

      // Redirigir a Stripe
      window.location.href = data.url;
      
      return { success: true, data };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error creating checkout';
      setError(errorMessage);
      console.error('❌ Checkout error:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createCheckoutSession
  };
};
```

---

## 🎨 5. Componente de Resumen (CartSummary)

```tsx
// components/CartSummary.tsx
import React from 'react';
import { useCart } from '../hooks/useCart';

export const CartSummary: React.FC = () => {
  const { 
    cart, 
    loading,
    hasMaisonPouletPromotion, 
    getPromotionDetails, 
    getTotalSavings,
    getShippingStatus
  } = useCart();

  if (loading) return <div>Cargando...</div>;
  if (!cart) return <div>Error cargando carrito</div>;

  const { summary } = cart;
  const promotionDetails = getPromotionDetails();
  const shippingStatus = getShippingStatus();

  return (
    <div className="cart-summary">
      <h3>Resumen del Pedido</h3>
      
      {/* Subtotal */}
      <div className="summary-line">
        <span>Subtotal ({summary.totalItems} items):</span>
        <span>${summary.subtotal.toFixed(2)}</span>
      </div>

      {/* Impuestos */}
      {summary.totalTPS > 0 && (
        <div className="summary-line">
          <span>TPS:</span>
          <span>${summary.totalTPS.toFixed(2)}</span>
        </div>
      )}
      
      {summary.totalTVQ > 0 && (
        <div className="summary-line">
          <span>TVQ:</span>
          <span>${summary.totalTVQ.toFixed(2)}</span>
        </div>
      )}

      {/* ✨ NUEVA SECCIÓN - Envío con promoción */}
      <div className="summary-line shipping-section">
        <span>Envío:</span>
        <div className="shipping-details">
          {shippingStatus.isFree ? (
            <span className="free-shipping">GRATIS</span>
          ) : (
            <span>${shippingStatus.cost.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* ✨ NUEVO COMPONENTE - Banner de promoción */}
      {hasMaisonPouletPromotion() && promotionDetails && (
        <div className="promotion-banner">
          <div className="promotion-header">
            <span className="promotion-icon">🎉</span>
            <span className="promotion-title">¡Envío Gratis!</span>
          </div>
          <div className="promotion-details">
            <div className="promotion-subtitle">
              Promoción Maison de Poulet - Riviera Sur
            </div>
            <div className="promotion-savings">
              Ahorro: ${promotionDetails.discount.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Descuentos de cupones */}
      {summary.discountAmount > 0 && (
        <div className="summary-line">
          <span>Descuento (cupón):</span>
          <span className="discount">-${summary.discountAmount.toFixed(2)}</span>
        </div>
      )}

      {/* ✨ NUEVA LÍNEA - Ahorros totales */}
      {getTotalSavings() > 0 && (
        <div className="summary-line total-savings">
          <span><strong>Ahorros totales:</strong></span>
          <span className="savings"><strong>-${getTotalSavings().toFixed(2)}</strong></span>
        </div>
      )}

      {/* Total */}
      <div className="summary-line total-line">
        <span><strong>Total:</strong></span>
        <span><strong>${summary.total.toFixed(2)}</strong></span>
      </div>
    </div>
  );
};
```

---

## 🎨 6. Estilos CSS

```css
/* styles/promotion.css */

.promotion-banner {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  border: 2px solid #2E7D32;
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  color: white;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  animation: promotionPulse 2s ease-in-out infinite;
}

.promotion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.promotion-icon {
  font-size: 20px;
}

.promotion-title {
  font-weight: 700;
  font-size: 16px;
}

.promotion-details {
  margin-left: 28px;
}

.promotion-subtitle {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.promotion-savings {
  font-size: 14px;
  font-weight: 600;
}

.free-shipping {
  color: #4CAF50;
  font-weight: 700;
  text-transform: uppercase;
}

.savings {
  color: #4CAF50;
  font-weight: 600;
}

.total-savings {
  border-top: 1px solid #e0e0e0;
  padding-top: 8px;
  margin-top: 8px;
}

@keyframes promotionPulse {
  0%, 100% { 
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  }
  50% { 
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
  }
}
```

---

## 🧪 7. Testing y Validación

### **Datos de Prueba**

**Para activar la promoción necesitas:**
```javascript
// Usuario con dirección en Riviera Sur
const testUser = {
  codigo_postal: 'J4B 3H7' // ✅ Riviera Sur
};

// Producto de Maison de Poulet
const testProduct = {
  subcategoria_id: 13      // ✅ Maison de Poulet
};

// Fecha válida
const currentDate = new Date(); // ✅ Antes del 1 septiembre 2025
```

### **Casos de Prueba**

1. **✅ Promoción Activa:**
   - Producto subcategoria_id = 13
   - Código postal J4B, J4G, J4H, etc.
   - Resultado: `shippingCost = 0, shippingDiscount = 10`

2. **❌ Sin Promoción:**
   - Producto subcategoria_id ≠ 13
   - Resultado: `shippingCost = 10, shippingDiscount = 0`

3. **❌ Fuera de Zona:**
   - Producto subcategoria_id = 13
   - Código postal H1A (Montreal)
   - Resultado: `shippingCost = 17, shippingDiscount = 0`

---

## ✅ Checklist de Implementación

### **1. Backend (Ya Listo)**
- [x] Promoción automática implementada
- [x] Campos nuevos en respuestas
- [x] Logs de debugging
- [x] Integración con Stripe

### **2. Frontend (Por Hacer)**
- [ ] Actualizar interfaces TypeScript
- [ ] Implementar hook `useCart` con nuevas funciones
- [ ] Implementar hook `useStripeCheckout` actualizado
- [ ] Crear componente `CartSummary` con banner de promoción
- [ ] Agregar estilos CSS
- [ ] Probar con datos de Maison de Poulet

### **3. Validaciones**
- [ ] Verificar campos en respuesta de `/api/v1/cart`
- [ ] Verificar campos en respuesta de checkout
- [ ] Probar promoción con subcategoria_id = 13
- [ ] Probar en códigos postales de Riviera Sur

---

## 🚨 Notas Importantes

1. **Promoción Temporal:** Expira automáticamente el 1 de septiembre 2025
2. **Solo Maison de Poulet:** subcategoria_id = 13
3. **Solo Riviera Sur:** Códigos postales J3V, J4B-J4Z, J5A-J5C, etc.
4. **Envío $0:** El cliente no paga nada por el domicilio
5. **Ahorro Visible:** Se muestra claramente cuánto se ahorró

La implementación está lista para usar inmediatamente. Solo necesitas actualizar el frontend con los nuevos campos y funciones.