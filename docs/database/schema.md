# Base de Datos `Tout À Un Clic Là` - Supabase Schema

Este documento detalla la estructura principal de la base de datos PostgreSQL alojada en Supabase para el proyecto. El esquema contiene **13 tablas principales** que operan bajo habilitación RLS (Row Level Security).

## 1. Usuarios y Accesos

### Tabla: `usuarios`
Maneja la información central de los clientes de la aplicación.

- **Columnas**:
  - `id` (uuid, PK): Generado con `gen_random_uuid()`.
  - `correo_electronico` (text, UNIQUE): Requiere validación Regex de email.
  - `telefono` (text, nullable).
  - `url_avatar` (text, nullable).
  - `verificado` (boolean): Default `false`.
  - `autenticacion_social` (boolean): Default `false`. Indica si entró por Google, Apple, etc.
  - `proveedor_social` (varchar, nullable).
  - `google_id` (varchar, nullable).
  - `nombre` (text, nullable).
  - `intentos_login_fallidos` (int4): Límite 0-10.
  - `fecha_ultimo_login` (timestamptz, nullable).
  - `cuenta_bloqueada` (boolean): Default `false`.
  - `razon_bloqueo` (text, nullable).
  - `token_verificacion_email` (text, UNIQUE, nullable): Token OTP 6 dígitos (15 min).
  - `fecha_expiracion_token` (timestamptz, nullable).
  - `password_hash` (text, nullable).
  - `direccion_principal_id` (uuid, FK `direcciones_envio.id`).
  - `stripe_customer_id` (text, nullable).
  - `fecha_creacion` / `fecha_actualizacion` (timestamptz).

### Tabla: `direcciones_envio`
Catálogo de ubicaciones donde un usuario recibe sus pedidos.
- **Columnas**:
  - `id` (uuid, PK).
  - `usuario_id` (uuid, FK `usuarios.id`).
  - `direccion` (text).
  - `ciudad` (text).
  - `estado` (text).
  - `codigo_postal` (text).
  - `pais` (text).

### Tabla: `restaurantes_usuarios`
Gestión de credenciales para administradores de panel de restaurante ("Dueños local").
- **Columnas**:
  - `id` (uuid, PK).
  - `restaurante_id` (int8, FK `subcategorias.id`): El restaurante que maneja este usuario.
  - `username` (varchar, UNIQUE).
  - `password_hash` (varchar).
  - `is_active` (boolean, Default `true`).
  - `last_login`, `created_at` (timestamptz).


## 2. Catálogo de Productos

### Tabla: `categorias` (Nivel 1)
Clasificación amplia (Ej. Restaurantes, Tienda, etc.)
- **Columnas**:
  - `id` (int8, PK, Identity).
  - `nombre` (text, UNIQUE).
  - `descripcion` (text, nullable).

### Tabla: `subcategorias` (Nivel 2 - Funciona como Establecimiento/Restaurante)
Dado que en esta plataforma las subcategorías representan locales o restaurantes físicos.
- **Columnas**:
  - `id` (int8, PK, Identity).
  - `nombre` (text).
  - `categoria_id` (int8, FK `categorias.id`).
  - `Imagen` (text, nullable).
  - `Descripcion` (text, nullable).
  - `codigo_postal` (text, nullable): Para cálculos de costos de envío o zona de influencia (Montreal, Rivera Sur).
  - `disponible` (boolean, Default `true`).
  - `gmail` (varchar, nullable).
  - `dias_abiertos` (jsonb): Arreglo de configuración por días (Apertura, Clausura, Estado).

### Tabla: `productos`
Items comerciables del catálogo.
- **Columnas**:
  - `id` (int8, PK, Identity).
  - `nombre` (text).
  - `descripcion` (text, nullable).
  - `precio` (numeric).
  - `categoria_id` (int8, FK `categorias.id`).
  - `subcategoria_id` (int8, FK `subcategorias.id`): Restaurante o Tienda.
  - `stock` (int4, Default `0`).
  - `fecha_creacion` (timestamptz).
  - `imagen_principal`, `imagen_secundaria`, `imagen_terciaria` (text).
  - `TPS` (int2), `TVQ` (numeric).
  - `ecoprecio` (boolean).
  - `dias_disponibles` (ARRAY _int4): Ejemplo `{0,1,2}` (Saber qué días en concreto a la semana se puede pedir).
  - `descuento` (int8, nullable).

### Tabla: `reviews`
Reseñas que envían los usuarios para comentar productos experimentados.
- **Columnas**:
  - `id` (uuid, PK).
  - `producto_id` (int8, FK `productos.id`).
  - `usuario_id` (uuid, FK `usuarios.id`).
  - `estrellas` (int4, check 1-5).
  - `comentario` (text, nullable).
  - `fecha_creacion` (timestamptz).

### Tabla: `favoritos`
Marcadores de interés de los usuarios para guardar productos.
- **Columnas**:
  - `id` (uuid, PK).
  - `usuario_id` (uuid, FK `usuarios.id`).
  - `producto_id` (int8, FK `productos.id`).
  - `fecha_agregado` (timestamptz).

## 3. Ventas y Transacciones

### Tabla: `carrito`
Items almacenados en la cesta de compras activa de un usuario antes del Checkout.
- **Columnas**:
  - `id` (uuid, PK).
  - `usuario_id` (uuid, FK `usuarios.id`).
  - `producto_id` (int8, FK `productos.id`).
  - `cantidad` (int4, check > 0).
  - `metodo_entrega` (text, check en lista `['puerta', 'manos', 'recepcion']`).
  - `notas_entrega` (text).
  - `cupon_codigo` (text, nullable).
  - `cupon_tipo` (text, nullable).
  - `cupon_descuento` (numeric).
  - `cupon_aplicado_fecha` (timestamptz).
  - `fecha_actualizacion` (timestamptz).

### Tabla: `pedidos`
Orden confirmada de compra (Facturación).
- **Columnas Principales**:
  - `id` (int8, PK, Identity).
  - `usuario_id` (uuid, FK `usuarios.id`).
  - `fecha_pedido` (timestamptz).
  - `estado` (text).
  - `direccion_envio_id` (uuid, FK `direcciones_envio.id`).
- **Valores Financieros**:
  - `subtotal` (numeric).
  - `impuestos_tps`, `impuestos_tvq` (numeric).
  - `costos_envio` (numeric).
  - `descuento` (numeric).
  - `total` (numeric).
- **Relaciones con Stripe**:
  - `stripe_checkout_session_id`, `stripe_payment_intent_id` (text).
- **Logística y Cupones**:
  - `metodo_entrega` (text).
  - `notas_entrega`, `notas`, `notas_email` (text).
  - `codigo_cupon`, `tipo_cupon` (text).
  - `envio_gratis`, `aplicado_envio_gratis` (boolean).
  - `email_confirmacion_enviado` (boolean).
- **Fechas y Reembolsos**:
  - `fecha_pago`, `fecha_email_enviado`, `fecha_reembolso` (timestamptz).
  - `monto_reembolso` (numeric).

### Tabla: `detalles_pedido`
Lista inmutable de items congelados asociados al precio en el que se compró durante la orden (Registro Histórico).
- **Columnas**:
  - `id` (uuid, PK).
  - `pedido_id` (int8, FK `pedidos.id`).
  - `producto_id` (int8, FK `productos.id`).
  - `cantidad` (int4, check > 0).
  - `precio_unitario` (numeric, check > 0).

## 4. Promociones y Marketing (Cupones)

### Tabla: `cupones`
Listado maestro de los códigos promocionales disponibles.
- **Columnas**:
  - `id` (int8, PK, Identity).
  - `codigo` (text, UNIQUE).
  - `descuento` (numeric).
  - `fecha_expiracion` (date, nullable).
  - `limite_usos` (int4, nullable).
  - `activo` (boolean, Default `true`).
  - `usuario_asignado` (uuid, FK `usuarios.id`, nullable): En caso de ser de uso único y privado.
  - `descripcion` (text, nullable).

### Tabla: `cupones_usos`
Tabla de Tracking transaccional para saber quién y cuándo consumió qué cupón (Prevención de Fraude).
- **Columnas**:
  - `id` (uuid, PK).
  - `cupon_id` (int8, FK `cupones.id`).
  - `usuario_id` (uuid, FK `usuarios.id`).
  - `pedido_id` (int8, FK `pedidos.id`).
  - `fecha_uso` (timestamptz).
  - `ip_usuario` (inet).

