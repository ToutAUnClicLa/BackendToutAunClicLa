# Users API Routes

Ubicación: `src/routes/users.route.js`
Controladores: 
- `src/controllers/userController.js`
- `src/controllers/authController.js`

**Nota:** Existen rutas dedicadas al usuario operando sobre sí mismo (perfil, contraseñas, etc.) y rutas dedicadas al administrador manejando a dichos usuarios.

## Rutas de Usuario (Self-service)

Requieren estar autenticado (`authMiddleware`).

| Método | Endpoint | Acción | Validaciones |
|---|---|---|---|
| `PUT` | `/api/v1/users/profile` | Actualiza la información del perfil propio | `validateRequest(updateProfileSchema)` |
| `PUT` | `/api/v1/users/password` | Cambia la contraseña actual | `validateRequest(changePasswordSchema)` |
| `PUT` | `/api/v1/users/primary-address` | Asigna una dirección del usuario como la principal de facto | `validateRequest(setPrimaryAddressSchema)` |
| `DELETE` | `/api/v1/users/delete` | (Soft) Elimina o desactiva la cuenta solicitando contraseña de confirmación | `validateRequest(deleteAccountSchema)` |

## Rutas de Admin

Requieren nivel administrativo (`authMiddleware` + `adminMiddleware`).

| Método | Endpoint | Acción | Validaciones |
|---|---|---|---|
| `GET` | `/api/v1/users/` | Listar usuarios | |
| `PUT` | `/api/v1/users/:id/status` | Cambia el estatus de un usuario (ej. bloquearlo, añadirle el "reason" de bloqueo) | `validateRequest(updateUserStatusSchema)` |

## Detalles Destacados

- Se maneja la eliminación de la cuenta de usuario propia de manera segura pidiendo una validación de su contraseña obligatoria para prevenir que un atacante borre la cuenta con una simple sesión robada en el navegador.
