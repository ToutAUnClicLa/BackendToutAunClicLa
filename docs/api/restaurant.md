# Restaurant Admin API Routes

Ubicación: `src/routes/restaurant.route.js`
Controladores: 
- `src/controllers/restaurantAuthController.js`
- `src/controllers/restaurantAdminController.js`

**Nota:** Este archivo concentra exclusivamente las operaciones que realizan los administradores de los restaurantes individuales dentro de su propio panel de control, utilizando una validación especial denominada `restaurantAuthMiddleware`.

## Autenticación de Restaurante

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `POST` | `/api/v1/restaurant/login` | Iniciar sesión como restaurante | |
| `GET` | `/api/v1/restaurant/session` | Obtener sesión del restaurante | `restaurantAuthMiddleware` |

## Gestión de Perfil

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/restaurant/profile` | Obtener datos del restaurante | `restaurantAuthMiddleware` |
| `PUT` | `/api/v1/restaurant/profile` | Actualizar información del restaurante | `restaurantAuthMiddleware` |

## Gestión de Productos Locales

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/restaurant/products` | Ver productos de este restaurante | `restaurantAuthMiddleware` |
| `GET` | `/api/v1/restaurant/products/:id` | Obtener un producto local | `restaurantAuthMiddleware` |
| `POST` | `/api/v1/restaurant/products` | Crear un producto asociado al restaurante | `restaurantAuthMiddleware` |
| `PUT` | `/api/v1/restaurant/products/:id` | Modificar un producto local | `restaurantAuthMiddleware` |
| `DELETE` | `/api/v1/restaurant/products/:id` | Eliminar un producto local | `restaurantAuthMiddleware` |

## Pedidos y Estadísticas Locales

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/restaurant/orders` | Bandeja de pedidos del restaurante | `restaurantAuthMiddleware` |
| `GET` | `/api/v1/restaurant/stats` | Estadísticas financieras del restaurante | `restaurantAuthMiddleware` |

## Detalles Destacados

- A diferencia de los administradores generales, estos endpoints aseguran que **el alcance solo aplique al ID de propio del restaurante**. Un restaurante no puede modificar productos ni ver pedidos de los demás, bloqueado automáticamente a través del token y decodificado por el `restaurantAuthMiddleware`.
