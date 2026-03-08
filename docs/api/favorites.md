# Favorites API Routes

Ubicación: `src/routes/favorites.route.js`
Controlador: `src/controllers/favoritesController.js`

**Nota:** Todas las rutas requieren autenticación de usuario (`authMiddleware`).

## Rutas

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/favorites/` | Obtener favoritos del usuario | `authMiddleware` |
| `POST` | `/api/v1/favorites/` | Añadir producto a favoritos | `authMiddleware`, `validateRequest(favoriteSchema)` |
| `GET` | `/api/v1/favorites/status/:productId` | Verificar si un producto es favorito | `authMiddleware` |
| `DELETE` | `/api/v1/favorites/:productId` | Eliminar de favoritos | `authMiddleware` |

## Descripción de Endpoints

### `GET /`
- **Descripción:** Devuelve la lista de productos marcados como favoritos por el usuario actual.

### `POST /`
- **Descripción:** Añade un nuevo producto a la lista de favoritos del usuario.
- **Validación:** Validado contra `favoriteSchema`.

### `GET /status/:productId`
- **Descripción:** Devuelve un booleano indicando si el usuario actual ha marcado el producto (`:productId`) como favorito.

### `DELETE /:productId`
- **Descripción:** Remueve el producto especificado (`:productId`) de la lista de favoritos.
