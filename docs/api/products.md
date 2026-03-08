# Products API Routes

Ubicación: `src/routes/products.route.js`
Controlador: `src/controllers/productController.js`

**Nota:** Las rutas para obtener información de productos son públicas, mientras que la creación, edición y eliminación de productos requieren privilegios de administración y autenticación (`authMiddleware`, `adminMiddleware`).

## Rutas Públicas

No requieren autenticación para su uso.

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/api/v1/products/` | Listar todos los productos |
| `GET` | `/api/v1/products/categories` | Obtener categorías disponibles |
| `GET` | `/api/v1/products/subcategories` | Obtener todas las subcategorías |
| `GET` | `/api/v1/products/subcategories/:id` | Obtener detalles de una subcategoría |
| `GET` | `/api/v1/products/restaurants` | Obtener restaurantes |
| `GET` | `/api/v1/products/:id` | Obtener detalle de un producto específico |

## Rutas Protegidas (Admin)

Requieren `authMiddleware` y `adminMiddleware`.

| Método | Endpoint | Acción | Validaciones Extra |
|---|---|---|---|
| `POST` | `/api/v1/products/` | Crear un producto nuevo | `validateRequest(productSchema)` |
| `PUT` | `/api/v1/products/:id` | Modificar un producto existente | |
| `DELETE` | `/api/v1/products/:id` | Eliminar un producto | |

## Detalles Destacados

- Se maneja la estructura de `categorías` y `subcategorías` directamente desde las rutas de productos porque los restaurantes son tratados internamente como subcategorías.
- Las creaciones validan exhaustivamente los datos obligatorios a través de `productSchema`.
