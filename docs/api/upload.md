# Upload API Routes

Ubicación: `src/routes/upload.route.js`
Controlador: `src/controllers/uploadController.js`

Maneja de forma directa los servicios de almacenamiento (por ejemplo S3/Supabase Storage) para la carga controlada de archivos adjuntos y medios por parte de paneles administrativos.

## Rutas Protegidas

El único middleware habilitado es `restaurantAuthMiddleware`. Utilizado intensamente por los dueños o manejadores de restaurante a través de sus páginas individuales de productos locales.

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `POST` | `/api/v1/upload/image` | Subir una imagen temporal hacia el servidor | `restaurantAuthMiddleware`, `multer.upload.single('file')` |

## Notas sobre Carga de Archivos
- Multer ha sido configurado para que intercepte y verifique archivos `image/*` limitados internamente y rechace el resto como mecanismo de defensa contra subida arbitraria de código.
- Estas transferencias solo exponen `memoryStorage()`, enviando indirectamente el bloque de datos al gestor `uploadImage` en lugar de guardar permanentemente el binario en el HDD del backend.
