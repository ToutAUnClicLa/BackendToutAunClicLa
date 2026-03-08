# Super Admin API Routes

Ubicación: `src/routes/superAdmin.route.js`
Controlador: `src/controllers/superAdminController.js`

**Filtro Total:** TODOS los endpoints en este archivo requieren primero pasar por el filtro de autenticación normal `authMiddleware`, e inmediatamente después por el filtro global de permisos a través de `adminMiddleware`, bloqueando estas rutas completamente a clientes normales o perfiles restringidos de restaurantes locales.

## Gestión de Restaurantes y Sistema

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/api/v1/admin/restaurants` | Obtener listado de todos los restaurantes y credenciales de acceso |
| `POST` | `/api/v1/admin/restaurants` | Registrar un restaurante nuevo en el sistema |
| `DELETE` | `/api/v1/admin/restaurants/:id` | Eliminar un restaurante completo |
| `GET` | `/api/v1/admin/restaurants/:id/profile` | Ver y modificar la data interna del perfil general de un restaurante |

## Credenciales de Acceso Local (Restaurantes)

| Método | Endpoint | Acción |
|---|---|---|
| `POST` | `/api/v1/admin/restaurants/credentials` | Crear usuario/contraseña para el backend local de un restaurante |
| `PUT` | `/api/v1/admin/restaurants/credentials/:id` | Actualizar (o suspender) el usuario de inicio de sesión del restaurante |

## Analítica y Utilidades de Super Admin

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/api/v1/admin/stats` | Estadísticas financieras y métricas integradas para panel SuperAdmin |
| `GET` | `/api/v1/admin/orders` | Bandeja global con todos los pedidos de la plataforma (mismo formato de RestaurantOrdersManager) |

## Administración Base (Usuarios y Cupones)

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/api/v1/admin/users` | Listado general de todos los usuarios de la base de datos |
| `PUT` | `/api/v1/admin/users/:id/block` | Bloquear/Desbloquear un usuario manualmente para prohibir uso del app |
| `GET` | `/api/v1/admin/coupons` | Ver la lista de cupones de plataforma |
| `POST` | `/api/v1/admin/coupons` | Crear un cupón publicitario/promocional nuevo |
| `PUT` | `/api/v1/admin/coupons/:id/toggle` | Desactivar / Activar el cupón actual (Cambiar estatus sin borrarlo) |
| `DELETE` | `/api/v1/admin/coupons/:id` | Remover el cupón definitivamente |
