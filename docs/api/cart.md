# Cart API Routes

Ubicación: `src/routes/cart.route.js`
Controlador: `src/controllers/cartController.js`

**Nota:** Todas las rutas de carrito requieren que el usuario esté autenticado (`authMiddleware`).

## Rutas

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/cart/` | Obtener carrito activo | `authMiddleware` |
| `GET` | `/api/v1/cart/with-coupon` | Obtener carrito con cálculo de cupones | `authMiddleware` |
| `POST` | `/api/v1/cart/items` | Añadir ítem(s) al carrito | `authMiddleware`, `validateRequest(cartItemSchema)` |
| `PUT` | `/api/v1/cart/items/:id` | Editar ítem del carrito (ej. cantidad) | `authMiddleware` |
| `DELETE` | `/api/v1/cart/items/:id` | Eliminar ítem del carrito | `authMiddleware` |
| `DELETE` | `/api/v1/cart/` | Vaciar carrito por completo | `authMiddleware` |
| `POST` | `/api/v1/cart/apply-coupon` | Aplicar un cupón al carrito | `authMiddleware`, `couponRateLimiter`, `validateRequest(couponSchema)` |
| `DELETE` | `/api/v1/cart/remove-coupon` | Quitar el cupón aplicado al carrito | `authMiddleware` |
| `PUT` | `/api/v1/cart/delivery-options` | Actualizar opciones de entrega | `authMiddleware`, `validateRequest(deliveryOptionsSchema)` |

## Detalles Destacados
- **Cupones:** La lógica de aplicar cupones incorpora limitadores (`couponRateLimiter`) para impedir ataques de fuerza bruta intentando adivinar cupones.
- **Gestión de Entregas:** Permite acoplar opciones de envío directamente al estado del carrito (`deliveryOptionsSchema`).
