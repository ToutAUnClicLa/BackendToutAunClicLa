# Addresses API Routes

Ubicación: `src/routes/addresses.route.js`
Controlador: `src/controllers/addressController.js`

**Nota:** Todas las rutas requieren estar autenticado (`authMiddleware`).

## Rutas

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `GET` | `/api/v1/addresses` | Obtener direcciones del usuario | `authMiddleware` |
| `POST` | `/api/v1/addresses` | Crear nueva dirección | `authMiddleware`, `validateRequest(addressSchema)` |
| `PUT` | `/api/v1/addresses/:id` | Actualizar dirección existente | `authMiddleware`, `validateRequest(addressSchema)` |
| `DELETE` | `/api/v1/addresses/:id` | Eliminar dirección | `authMiddleware` |

## Descripción de Endpoints

### `GET /`
- **Descripción:** Obtiene todas las direcciones de envío asociadas al usuario autenticado.
- **Requiere Autenticación:** Sí

### `POST /`
- **Descripción:** Crea una nueva dirección de envío para el usuario.
- **Requiere Autenticación:** Sí
- **Validación:** Validado contra `addressSchema`.

### `PUT /:id`
- **Descripción:** Actualiza los datos de una dirección específica (identificada por `:id`).
- **Requiere Autenticación:** Sí
- **Validación:** Validado contra `addressSchema`.

### `DELETE /:id`
- **Descripción:** Elimina la dirección de envío especificada por `:id`.
- **Requiere Autenticación:** Sí
