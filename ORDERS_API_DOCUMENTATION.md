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

### **2. Estadísticas de Cuenta**

```http
GET /api/v1/orders/stats/summary
```

**Descripción:** Obtiene estadísticas resumidas para el dashboard de la cuenta del usuario.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 12,
    "totalSpent": 453.67,
    "ordersByStatus": {
      "pagado": 8,
      "enviado": 2,
      "entregado": 10,
      "cancelado": 1
    },
    "recentOrdersCount": 3,
    "averageOrderValue": 37.81,
    "lastOrderDate": "2025-08-20T22:23:30.536815+00:00"
  }
}
```

---

### **3. Detalle de Pedido Específico**

```http
GET /api/v1/orders/:id
```

**Descripción:** Obtiene información completa de un pedido específico del usuario.

**Parámetros:**
- `id` - ID del pedido

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "order": {
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
        "couponCode": null,
        "couponType": null,
        "freeShippingApplied": false,
        "finalTotal": 36.30
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
      "items": [
        {
          "id": 1,
          "name": "Producto Premium",
          "description": "Descripción del producto...",
          "quantity": 1,
          "unitPrice": 18.30,
          "totalPrice": 18.30,
          "category": "Electronics",
          "subcategory": "Smartphones",
          "images": [
            "https://ejemplo.com/imagen1.jpg",
            "https://ejemplo.com/imagen2.jpg"
          ],
          "sku": "PROD-001"
        }
      ],
      "paymentInfo": {
        "method": "stripe",
        "stripeSessionId": "cs_test_...",
        "stripePaymentIntentId": "pi_test_...",
        "paymentDate": "2025-08-20T22:23:30.536815+00:00",
        "refundInfo": {
          "isRefunded": false,
          "refundAmount": 0,
          "refundDate": null
        }
      },
      "tracking": {
        "orderPlaced": "2025-08-20T22:23:30.536815+00:00",
        "paymentConfirmed": "2025-08-20T22:23:30.536815+00:00",
        "processing": null,
        "shipped": null,
        "delivered": null
      },
      "emails": {
        "confirmationSent": true,
        "shippingSent": false
      },
      "notes": null
    }
  }
}
```

---

## 👥 Endpoints para Administradores

### **4. Lista de Todos los Pedidos (Admin)**

```http
GET /api/v1/orders
```

**Descripción:** Obtiene todos los pedidos con información del cliente (solo administradores).

**Query Parameters:**
```
page=1              # Página (opcional)
limit=10            # Límite por página (opcional)
status=pagado       # Filtrar por estado (opcional)
customer_email=     # Filtrar por email del cliente (opcional)
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
        "customer": {
          "id": "user-uuid",
          "name": "Juan Pérez",
          "email": "juan@ejemplo.com"
        },
        "summary": {
          "totalItems": 1,
          "productCount": 1
        },
        "paymentInfo": {
          "method": "stripe",
          "stripeSessionId": "cs_test_...",
          "paymentDate": "2025-08-20T22:23:30.536815+00:00"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalOrders": 156,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

### **5. Actualizar Estado de Pedido (Admin)**

```http
PUT /api/v1/orders/:id/status
```

**Descripción:** Actualiza el estado de un pedido (solo administradores).

**Body:**
```json
{
  "status": "enviado",
  "notes": "Enviado con Purolator, tracking: 123456789"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "orderId": 6,
    "previousStatus": "pagado",
    "newStatus": "enviado",
    "updatedAt": "2025-08-20T23:45:00.000Z",
    "notes": "Enviado con Purolator, tracking: 123456789"
  }
}
```

---

## 💻 Implementación en Frontend

### **Lista de Pedidos del Usuario**

```tsx
// hooks/useOrders.js
import { useState, useEffect } from 'react';

export const useOrders = (page = 1, limit = 10) => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/orders/my-orders?page=${page}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setOrders(data.data.orders);
        setPagination(data.data.pagination);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error fetching orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, limit]);

  return { orders, pagination, loading, error, refetch: fetchOrders };
};
```

### **Componente Lista de Pedidos**

```tsx
// components/OrdersList.tsx
import React from 'react';
import { useOrders } from '../hooks/useOrders';

export const OrdersList = () => {
  const { orders, pagination, loading, error } = useOrders();

  if (loading) return <div>Cargando pedidos...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="orders-list">
      <h2>Mis Pedidos ({pagination?.totalOrders})</h2>
      
      {orders.map(order => (
        <div key={order.id} className="order-card">
          <div className="order-header">
            <span className="order-number">{order.orderNumber}</span>
            <span className={`status ${order.status}`}>{order.status}</span>
          </div>
          
          <div className="order-info">
            <p>Fecha: {new Date(order.orderDate).toLocaleDateString()}</p>
            <p>Total: ${order.total.toFixed(2)} CAD</p>
            <p>Productos: {order.summary.totalItems}</p>
          </div>
          
          <div className="order-items">
            {order.itemsPreview.map(item => (
              <div key={item.id} className="item-preview">
                <img src={item.image} alt={item.name} />
                <span>{item.name} x{item.quantity}</span>
              </div>
            ))}
          </div>
          
          <div className="order-actions">
            <button onClick={() => router.push(`/orders/${order.id}`)}>
              Ver Detalles
            </button>
            {order.status === 'enviado' && (
              <button>Rastrear Envío</button>
            )}
          </div>
        </div>
      ))}
      
      {/* Paginación */}
      <div className="pagination">
        {pagination?.hasPreviousPage && (
          <button onClick={() => setPage(page - 1)}>
            Anterior
          </button>
        )}
        <span>Página {pagination?.currentPage} de {pagination?.totalPages}</span>
        {pagination?.hasNextPage && (
          <button onClick={() => setPage(page + 1)}>
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
};
```

### **Dashboard de Estadísticas**

```tsx
// components/OrderStats.tsx
import React, { useState, useEffect } from 'react';

export const OrderStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/orders/stats/summary`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando estadísticas...</div>;

  return (
    <div className="order-stats">
      <h3>Resumen de Pedidos</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Total de Pedidos</h4>
          <span className="stat-value">{stats.totalOrders}</span>
        </div>
        
        <div className="stat-card">
          <h4>Total Gastado</h4>
          <span className="stat-value">${stats.totalSpent.toFixed(2)}</span>
        </div>
        
        <div className="stat-card">
          <h4>Promedio por Pedido</h4>
          <span className="stat-value">${stats.averageOrderValue.toFixed(2)}</span>
        </div>
        
        <div className="stat-card">
          <h4>Pedidos Recientes</h4>
          <span className="stat-value">{stats.recentOrdersCount}</span>
        </div>
      </div>
      
      <div className="status-breakdown">
        <h4>Por Estado:</h4>
        {Object.entries(stats.ordersByStatus).map(([status, count]) => (
          <div key={status} className="status-item">
            <span className={`status-badge ${status}`}>{status}</span>
            <span>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **Detalle de Pedido**

```tsx
// pages/orders/[id].tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/orders/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setOrder(data.data.order);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando pedido...</div>;
  if (!order) return <div>Pedido no encontrado</div>;

  return (
    <div className="order-detail">
      <header className="order-header">
        <h1>Pedido {order.orderNumber}</h1>
        <span className={`status ${order.status}`}>{order.status}</span>
      </header>

      <div className="order-info-grid">
        <div className="order-summary">
          <h3>Resumen</h3>
          <p>Fecha: {new Date(order.orderDate).toLocaleDateString()}</p>
          <p>Estado: {order.status}</p>
          <p>Total: ${order.total.toFixed(2)} CAD</p>
        </div>

        <div className="shipping-info">
          <h3>Envío</h3>
          <address>
            {order.shipping.recipientName}<br/>
            {order.shipping.address}<br/>
            {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}<br/>
            {order.shipping.country}<br/>
            {order.shipping.phone}
          </address>
        </div>
      </div>

      <div className="order-items">
        <h3>Productos ({order.items.length})</h3>
        {order.items.map(item => (
          <div key={item.id} className="order-item">
            <div className="item-images">
              {item.images.map((image, index) => (
                <img key={index} src={image} alt={item.name} />
              ))}
            </div>
            <div className="item-details">
              <h4>{item.name}</h4>
              <p>{item.description}</p>
              <p>SKU: {item.sku}</p>
              <p>Categoría: {item.category} > {item.subcategory}</p>
            </div>
            <div className="item-pricing">
              <p>Cantidad: {item.quantity}</p>
              <p>Precio unitario: ${item.unitPrice.toFixed(2)}</p>
              <p><strong>Total: ${item.totalPrice.toFixed(2)}</strong></p>
            </div>
          </div>
        ))}
      </div>

      <div className="pricing-breakdown">
        <h3>Desglose de Precios</h3>
        <div className="pricing-table">
          <div className="pricing-row">
            <span>Subtotal:</span>
            <span>${order.pricing.subtotal.toFixed(2)}</span>
          </div>
          <div className="pricing-row">
            <span>TPS:</span>
            <span>${order.pricing.taxes.tps.toFixed(2)}</span>
          </div>
          <div className="pricing-row">
            <span>TVQ:</span>
            <span>${order.pricing.taxes.tvq.toFixed(2)}</span>
          </div>
          <div className="pricing-row">
            <span>Envío:</span>
            <span>${order.pricing.shipping.toFixed(2)}</span>
          </div>
          {order.pricing.discount > 0 && (
            <div className="pricing-row discount">
              <span>Descuento:</span>
              <span>-${order.pricing.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="pricing-row total">
            <span><strong>Total:</strong></span>
            <span><strong>${order.pricing.finalTotal.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      <div className="tracking-timeline">
        <h3>Estado del Pedido</h3>
        <div className="timeline">
          <div className={`timeline-item ${order.tracking.orderPlaced ? 'completed' : ''}`}>
            <span>Pedido Realizado</span>
            {order.tracking.orderPlaced && (
              <time>{new Date(order.tracking.orderPlaced).toLocaleString()}</time>
            )}
          </div>
          <div className={`timeline-item ${order.tracking.paymentConfirmed ? 'completed' : ''}`}>
            <span>Pago Confirmado</span>
            {order.tracking.paymentConfirmed && (
              <time>{new Date(order.tracking.paymentConfirmed).toLocaleString()}</time>
            )}
          </div>
          <div className={`timeline-item ${order.tracking.processing ? 'completed' : ''}`}>
            <span>En Procesamiento</span>
            {order.tracking.processing && (
              <time>{new Date(order.tracking.processing).toLocaleString()}</time>
            )}
          </div>
          <div className={`timeline-item ${order.tracking.shipped ? 'completed' : ''}`}>
            <span>Enviado</span>
            {order.tracking.shipped && (
              <time>{new Date(order.tracking.shipped).toLocaleString()}</time>
            )}
          </div>
          <div className={`timeline-item ${order.tracking.delivered ? 'completed' : ''}`}>
            <span>Entregado</span>
            {order.tracking.delivered && (
              <time>{new Date(order.tracking.delivered).toLocaleString()}</time>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 Estilos CSS Recomendados

```css
/* styles/orders.css */

.orders-list {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.order-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.order-number {
  font-weight: bold;
  font-size: 1.1rem;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status.pagado { background: #e8f5e8; color: #2e7d32; }
.status.enviado { background: #e3f2fd; color: #1565c0; }
.status.entregado { background: #f3e5f5; color: #7b1fa2; }
.status.cancelado { background: #ffebee; color: #c62828; }
.status.pendiente { background: #fff3e0; color: #ef6c00; }

.order-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.order-items {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.item-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.item-preview img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.order-actions {
  display: flex;
  gap: 0.5rem;
}

.order-actions button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.order-actions button:hover {
  background: #f0f0f0;
}

.order-actions button:first-child {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.order-actions button:first-child:hover {
  background: #5a6fd8;
}

/* Order Stats */
.order-stats {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-card h4 {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.status-breakdown {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Order Detail */
.order-detail {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
}

.order-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 2rem 0;
}

.order-summary,
.shipping-info {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.order-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 1rem;
  background: white;
}

.item-images {
  display: flex;
  gap: 0.5rem;
}

.item-images img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
}

.pricing-breakdown {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin: 2rem 0;
}

.pricing-table {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
}

.pricing-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.pricing-row.total {
  border-top: 2px solid #333;
  margin-top: 0.5rem;
  padding-top: 1rem;
  font-size: 1.1rem;
}

.pricing-row.discount {
  color: #28a745;
}

.timeline {
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e0e0e0;
}

.timeline-item {
  position: relative;
  padding-left: 60px;
  margin-bottom: 2rem;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e0e0e0;
}

.timeline-item.completed::before {
  background: #28a745;
}

.timeline-item span {
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
}

.timeline-item time {
  color: #666;
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 768px) {
  .order-info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .order-item {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .item-images {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .order-actions {
    flex-direction: column;
  }
  
  .order-info {
    grid-template-columns: 1fr;
  }
}
```

---

## 🔒 Seguridad y Validaciones

### **Validaciones Implementadas:**

1. **Autenticación JWT** en todos los endpoints
2. **Autorización por usuario** - Los usuarios solo pueden ver sus propios pedidos
3. **Validación de IDs** - UUIDs válidos requeridos
4. **Sanitización de entrada** - Validación de query parameters
5. **Control de acceso admin** - Endpoints administrativos protegidos

### **Manejo de Errores:**

```json
// Error 401 - No autenticado
{
  "error": "Unauthorized",
  "message": "Please provide a valid authentication token"
}

// Error 403 - Sin permisos
{
  "error": "Forbidden", 
  "message": "You don't have permission to access this order"
}

// Error 404 - Pedido no encontrado
{
  "error": "Not Found",
  "message": "Order not found"
}

// Error 400 - Datos inválidos
{
  "error": "Validation Error",
  "message": "Invalid order ID format"
}
```

---

## 📊 Performance y Optimización

### **Optimizaciones Implementadas:**

1. **Consultas selectivas** - Solo campos necesarios
2. **Paginación eficiente** - Limit/offset con conteo optimizado
3. **Joins optimizados** - Relaciones anidadas eficientes
4. **Índices recomendados:**
   ```sql
   CREATE INDEX idx_pedidos_usuario_fecha ON pedidos(usuario_id, fecha_pedido DESC);
   CREATE INDEX idx_detalles_pedido ON detalles_pedido(pedido_id);
   CREATE INDEX idx_pedidos_estado ON pedidos(estado);
   ```

### **Cache Recomendado:**

- **Lista de pedidos:** Cache por 5 minutos
- **Estadísticas:** Cache por 15 minutos  
- **Detalle de pedido:** Cache por 1 hora
- **Estados completados:** Cache por 24 horas

---

Esta documentación proporciona toda la información necesaria para implementar una interfaz completa de gestión de pedidos en el frontend, con ejemplos de código, estilos CSS y mejores prácticas de seguridad y performance.