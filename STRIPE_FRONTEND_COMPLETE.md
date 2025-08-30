# 🛍️ Implementación Completa Frontend - Stripe con Promociones

## 📋 Estructura Completa de Respuestas de API

### 1. **Respuesta del Carrito (`/api/v1/cart`)**
```typescript
interface CartResponse {
  cartItems: CartItem[];
  total: number;
  itemCount: number;
  pagination?: Pagination;
  appliedCoupon?: Coupon;
  summary: {
    totalItems: number;
    totalQuantity: number;
    subtotal: number;
    subtotalWithTaxes: number;
    subtotalWithConsigne: number;
    totalTPS: number;
    totalTVQ: number;
    totalConsigne: number;
    totalTaxes: number;
    shippingCost: number;                // 0 si hay promoción
    originalShippingCost: number;        // ✨ Costo original sin promoción
    shippingDiscount: number;            // ✨ Descuento aplicado por promoción
    shippingMessage?: string;            // ✨ Mensaje de la promoción
    needsAddress: boolean;
    promotionApplied: boolean;           // ✨ true si hay promoción activa
    shippingThreshold: number;
    discountAmount: number;
    total: number;
  };
}
```

### 2. **Respuesta de Checkout Session (`/api/v1/stripe/checkout/create-session`)**
```typescript
interface StripeCheckoutResponse {
  success: boolean;
  sessionId: string;
  url: string;                          // URL para redirigir a Stripe
  orderSummary: {
    items: OrderItem[];
    subtotal: string;
    tps: string;
    tvq: string;
    consigne: string;
    originalShippingCost: string;       // ✨ "10.00" (costo original)
    shippingCost: string;               // ✨ "0.00" (costo final)
    shippingDiscount: string;           // ✨ "10.00" (descuento aplicado)
    promotionApplied: boolean;          // ✨ true si promoción activa
    freeShipping: boolean;              // true para cupones
    discount: string;                   // Descuento de cupones
    total: string;                      // Total final
    savings: string;                    // ✨ Ahorros totales (cupones + envío)
    coupon?: Coupon;
    shippingAddress: Address;
  };
}
```

---

## 🎯 Servicios de API Completos

### **Servicio de Carrito**
```typescript
// services/cartService.ts
export class CartService {
  private baseUrl = '/api/v1';
  
  async getCart(): Promise<CartResponse> {
    const response = await fetch(`${this.baseUrl}/cart`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cart: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getCartWithCoupon(couponCode: string): Promise<CartResponse> {
    const response = await fetch(`${this.baseUrl}/cart/with-coupon`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coupon_code: couponCode })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to apply coupon: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private getToken(): string {
    return localStorage.getItem('token') || '';
  }
}
```

### **Servicio de Stripe**
```typescript
// services/stripeService.ts
export class StripeService {
  private baseUrl = '/api/v1/stripe';
  
  async createCheckoutSession(params: {
    shipping_address_id: string;
    coupon_code?: string;
    success_url?: string;
    cancel_url?: string;
  }): Promise<StripeCheckoutResponse> {
    const response = await fetch(`${this.baseUrl}/checkout/create-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shipping_address_id: params.shipping_address_id,
        coupon_code: params.coupon_code || '',
        success_url: params.success_url || `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: params.cancel_url || `${window.location.origin}/checkout/cancel`
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  async getSessionStatus(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/checkout/session-status/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get session status: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private getToken(): string {
    return localStorage.getItem('token') || '';
  }
}
```

---

## 🪝 Hooks Avanzados

### **Hook de Carrito Completo**
```typescript
// hooks/useCart.ts
import { useState, useEffect, useCallback } from 'react';
import { CartService } from '../services/cartService';

export const useCart = () => {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const cartService = new CartService();
  
  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await cartService.getCart();
      setCart(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading cart');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const applyCoupon = useCallback(async (couponCode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await cartService.getCartWithCoupon(couponCode);
      setCart(data);
      return { success: true, cart: data };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error applying coupon';
      setError(error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, []);
  
  // ✨ FUNCIONES ESPECÍFICAS DE PROMOCIÓN
  const hasMaisonPouletPromotion = (): boolean => {
    return Boolean(
      cart?.summary?.promotionApplied && 
      cart?.summary?.shippingDiscount > 0
    );
  };
  
  const getPromotionDetails = () => {
    if (!hasMaisonPouletPromotion()) return null;
    
    return {
      isActive: true,
      discount: cart?.summary?.shippingDiscount || 0,
      originalCost: cart?.summary?.originalShippingCost || 0,
      message: cart?.summary?.shippingMessage || '',
      savings: cart?.summary?.shippingDiscount || 0
    };
  };
  
  const getTotalSavings = (): number => {
    const shippingDiscount = cart?.summary?.shippingDiscount || 0;
    const couponDiscount = cart?.summary?.discountAmount || 0;
    return shippingDiscount + couponDiscount;
  };
  
  const hasFreeShipping = (): boolean => {
    return cart?.summary?.shippingCost === 0;
  };
  
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);
  
  return {
    cart,
    loading,
    error,
    fetchCart,
    applyCoupon,
    // Promoción functions
    hasMaisonPouletPromotion,
    getPromotionDetails,
    getTotalSavings,
    hasFreeShipping
  };
};
```

### **Hook de Stripe Checkout**
```typescript
// hooks/useStripeCheckout.ts
import { useState, useCallback } from 'react';
import { StripeService } from '../services/stripeService';

export const useStripeCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<StripeCheckoutResponse | null>(null);
  
  const stripeService = new StripeService();
  
  const createCheckoutSession = useCallback(async (params: {
    addressId: string;
    couponCode?: string;
  }) => {
    setLoading(true);
    setError(null);
    setSessionData(null);
    
    try {
      console.log('🚀 Creating Stripe checkout session...', params);
      
      const data = await stripeService.createCheckoutSession({
        shipping_address_id: params.addressId,
        coupon_code: params.couponCode
      });
      
      setSessionData(data);
      
      // ✨ Log específico para promociones
      if (data.orderSummary.promotionApplied) {
        console.log('🎉 Maison de Poulet promotion detected!', {
          originalShipping: data.orderSummary.originalShippingCost,
          finalShipping: data.orderSummary.shippingCost,
          discount: data.orderSummary.shippingDiscount,
          totalSavings: data.orderSummary.savings
        });
      }
      
      // Redirigir automáticamente a Stripe
      window.location.href = data.url;
      
      return { success: true, data };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error creating checkout session';
      setError(errorMessage);
      console.error('❌ Checkout error:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);
  
  const getSessionStatus = useCallback(async (sessionId: string) => {
    try {
      return await stripeService.getSessionStatus(sessionId);
    } catch (err) {
      console.error('❌ Error getting session status:', err);
      throw err;
    }
  }, []);
  
  return {
    loading,
    error,
    sessionData,
    createCheckoutSession,
    getSessionStatus
  };
};
```

---

## 🎨 Componentes de UI

### **Componente de Resumen del Carrito**
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
    hasFreeShipping
  } = useCart();

  if (loading) return <div className="cart-loading">Cargando carrito...</div>;
  if (!cart) return <div className="cart-error">Error cargando carrito</div>;

  const { summary } = cart;
  const promotionDetails = getPromotionDetails();

  return (
    <div className="cart-summary">
      <h3>Resumen del Pedido</h3>
      
      {/* Items y subtotal */}
      <div className="summary-line">
        <span>Subtotal ({summary.totalItems} items):</span>
        <span>${summary.subtotal.toFixed(2)}</span>
      </div>

      {/* Impuestos */}
      {summary.totalTPS > 0 && (
        <div className="summary-line">
          <span>TPS (5%):</span>
          <span>${summary.totalTPS.toFixed(2)}</span>
        </div>
      )}
      
      {summary.totalTVQ > 0 && (
        <div className="summary-line">
          <span>TVQ (9.975%):</span>
          <span>${summary.totalTVQ.toFixed(2)}</span>
        </div>
      )}

      {/* Depósito */}
      {summary.totalConsigne > 0 && (
        <div className="summary-line">
          <span>Depósito (reembolsable):</span>
          <span>${summary.totalConsigne.toFixed(2)}</span>
        </div>
      )}

      {/* ✨ SECCIÓN DE ENVÍO CON PROMOCIÓN */}
      <div className="summary-line shipping-line">
        <span>Envío:</span>
        <div className="shipping-cost">
          {hasFreeShipping() ? (
            <span className="free-shipping">GRATIS</span>
          ) : (
            <span>${summary.shippingCost.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* ✨ BANNER DE PROMOCIÓN MAISON DE POULET */}
      {hasMaisonPouletPromotion() && promotionDetails && (
        <div className="promotion-banner maison-poulet">
          <div className="promotion-header">
            <span className="promotion-icon">🎉</span>
            <span className="promotion-title">¡Envío Gratis!</span>
          </div>
          <div className="promotion-details">
            <div className="promotion-subtitle">Promoción Maison de Poulet - Riviera Sur</div>
            <div className="promotion-savings">
              Ahorro: ${promotionDetails.discount.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de envío */}
      {summary.shippingMessage && (
        <div className="shipping-message">
          <small>{summary.shippingMessage}</small>
        </div>
      )}

      {/* Descuentos de cupones */}
      {summary.discountAmount > 0 && (
        <div className="summary-line discount-line">
          <span>Descuento (cupón):</span>
          <span className="discount-amount">-${summary.discountAmount.toFixed(2)}</span>
        </div>
      )}

      {/* ✨ LÍNEA DE AHORROS TOTALES */}
      {getTotalSavings() > 0 && (
        <div className="summary-line savings-total">
          <span><strong>Ahorros totales:</strong></span>
          <span className="savings-amount"><strong>-${getTotalSavings().toFixed(2)}</strong></span>
        </div>
      )}

      {/* Total final */}
      <div className="summary-line total-line">
        <span><strong>Total:</strong></span>
        <span className="total-amount"><strong>${summary.total.toFixed(2)}</strong></span>
      </div>

      {/* Información adicional */}
      {!hasFreeShipping() && !hasMaisonPouletPromotion() && (
        <div className="shipping-info">
          <small>Envío gratis en pedidos de ${summary.shippingThreshold} o más</small>
        </div>
      )}
    </div>
  );
};
```

### **Botón de Checkout Completo**
```tsx
// components/CheckoutButton.tsx
import React, { useState } from 'react';
import { useStripeCheckout } from '../hooks/useStripeCheckout';
import { useCart } from '../hooks/useCart';

interface CheckoutButtonProps {
  addressId: string;
  couponCode?: string;
  disabled?: boolean;
  className?: string;
}

export const CheckoutButton: React.FC<CheckoutButtonProps> = ({
  addressId,
  couponCode = '',
  disabled = false,
  className = ''
}) => {
  const { createCheckoutSession, loading, error } = useStripeCheckout();
  const { cart, hasMaisonPouletPromotion, getPromotionDetails } = useCart();
  
  const [showPromotionPreview, setShowPromotionPreview] = useState(false);
  
  const handleCheckout = async () => {
    if (!addressId) {
      alert('Por favor selecciona una dirección de envío');
      return;
    }

    if (!cart?.cartItems?.length) {
      alert('Tu carrito está vacío');
      return;
    }

    await createCheckoutSession({
      addressId,
      couponCode
    });
  };

  const promotionDetails = getPromotionDetails();

  return (
    <div className="checkout-section">
      {/* ✨ PREVIEW DE PROMOCIÓN */}
      {hasMaisonPouletPromotion() && promotionDetails && (
        <div className="checkout-promotion-preview">
          <div className="promotion-badge">
            🎉 ¡Envío Gratis! - Ahorro ${promotionDetails.discount.toFixed(2)}
          </div>
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={handleCheckout}
        disabled={disabled || loading || !cart?.cartItems?.length}
        className={`checkout-button ${loading ? 'loading' : ''} ${className}`}
      >
        {loading ? (
          <span className="checkout-loading">
            <span className="spinner"></span>
            Redirigiendo a Stripe...
          </span>
        ) : (
          <span className="checkout-text">
            Pagar ${cart?.summary.total.toFixed(2) || '0.00'}
          </span>
        )}
      </button>

      {/* Error handling */}
      {error && (
        <div className="checkout-error">
          <span className="error-icon">❌</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* Info adicional */}
      <div className="checkout-info">
        <small>Serás redirigido a Stripe para completar el pago de forma segura</small>
      </div>
    </div>
  );
};
```

---

## 🎨 Estilos CSS

```css
/* styles/cart-promotion.css */

.maison-poulet {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  border: 2px solid #2E7D32;
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  color: white;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  animation: promotionGlow 3s ease-in-out infinite;
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
}

.promotion-savings {
  font-size: 14px;
  font-weight: 600;
  margin-top: 4px;
}

.free-shipping {
  color: #4CAF50;
  font-weight: 700;
  text-transform: uppercase;
}

.savings-amount {
  color: #4CAF50;
  font-weight: 600;
}

.checkout-promotion-preview {
  background: #e8f5e8;
  border: 1px solid #4CAF50;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  text-align: center;
}

.promotion-badge {
  color: #2E7D32;
  font-weight: 600;
  font-size: 14px;
}

@keyframes promotionGlow {
  0%, 100% { 
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  }
  50% { 
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
  }
}

.checkout-button {
  width: 100%;
  background: #1976D2;
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.checkout-button:hover:not(:disabled) {
  background: #1565C0;
  transform: translateY(-1px);
}

.checkout-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.checkout-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## ✅ Checklist de Implementación

### **1. Instalar y Configurar**
- [ ] Copiar interfaces TypeScript
- [ ] Implementar servicios (`CartService`, `StripeService`)
- [ ] Agregar hooks (`useCart`, `useStripeCheckout`)

### **2. Componentes UI**
- [ ] Implementar `CartSummary` con soporte de promociones
- [ ] Implementar `CheckoutButton` con preview
- [ ] Agregar estilos CSS de promoción

### **3. Testing**
- [ ] Probar carrito con productos de Maison de Poulet
- [ ] Verificar funcionalidad en Riviera Sur
- [ ] Probar checkout completo con promoción

### **4. Funcionalidades Clave**
- [ ] Banner visual de promoción activa
- [ ] Mensaje "Envío GRATIS" claramente visible
- [ ] Ahorro específico mostrado ($10, $25, etc.)
- [ ] Logs de debugging en consola
- [ ] Manejo de errores robusto

¡La promoción expira automáticamente el 1 de septiembre de 2025! 🗓️