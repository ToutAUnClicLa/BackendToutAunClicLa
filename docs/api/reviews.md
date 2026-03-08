# Reviews API Routes

Ubicación: `src/routes/reviews.route.js`
Controlador: `src/controllers/reviewController.js`

## Rutas Públicas

No requieren autenticación.

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/api/v1/reviews/product/:productId` | Obtener todas las reviews de un producto |

## Rutas Protegidas

Requieren `authMiddleware` con un usuario activo logueado en la aplicación.

| Método | Endpoint | Acción | Validaciones |
|---|---|---|---|
| `POST` | `/api/v1/reviews/` | Crear una nueva reseña de usuario | `validateRequest(reviewSchema)` |
| `PUT` | `/api/v1/reviews/:id` | Modificar reseña existente (solo su autor o Admin) | |
| `DELETE` | `/api/v1/reviews/:id` | Eliminar reseña (solo su autor o Admin) | |
