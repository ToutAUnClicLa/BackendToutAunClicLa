# Orders API Routes

Ubicación: `src/routes/orders.route.js`
Controlador: `src/controllers/orderController.js`

**Nota:** Todas las rutas de pedidos (Orders) requieren autenticación (`authMiddleware`). Además, las rutas administrativas requieren privilegios de administrador (`adminMiddleware`).

## Rutas

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/orders/my-orders` | Obtener historial de pedidos del usuario | `authMiddleware` |
| `GET` | `/api/v1/orders/stats/summary` | Obtener resumen estadístico de usuario | `authMiddleware` |
| `GET` | `/api/v1/orders/:id` | Obtener detalle de un pedido | `authMiddleware` |
| `POST` | `/api/v1/orders/` | Crear nuevo pedido | `authMiddleware`, `validateRequest(createOrderSchema)` |
| `PUT` | `/api/v1/orders/:id/cancel` | Cancelar pedido por el usuario | `authMiddleware` |
| `GET` | `/api/v1/orders/` | Ver todos los pedidos (Panel general) | `authMiddleware`, `adminMiddleware` |
| `PUT` | `/api/v1/orders/:id/status` | Cambiar el estado de un pedido (Admin) | `authMiddleware`, `adminMiddleware`, `validateRequest(updateOrderStatusSchema)` |

## Validaciones Específicas

- **`createOrderSchema`**: Requiere `addressId` en formato UUID y `paymentMethodId` de Stripe.
- **`updateOrderStatusSchema`**: Sólo permite valores específicos para cambiar el estado de la orden (`pendiente`, `procesando`, `enviado`, `entregado`, `cancelado`, `pagado`).

## Detalles Destacados

- Las rutas bajo `/my-orders` operan bajo el contexto del usuario autenticado actual.
- Existen endpoints estadísticos rápidos como `/stats/summary` enfocados en enriquecer componentes del frontend.
