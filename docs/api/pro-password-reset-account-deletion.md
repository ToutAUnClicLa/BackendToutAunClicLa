# Módulo Pro — Recuperación de contraseña y eliminación de cuenta

Guía de integración para el frontend. Contratos verificados contra el código
real del backend (`src/controllers/proAuthController.js`,
`src/controllers/proProfileController.js`, `src/routes/pro.route.js`).

> **Prerrequisito de infraestructura**: la migración
> `migrations/20260713_01_add_password_reset_pro.sql` debe estar aplicada en
> Supabase antes de que estos endpoints funcionen en cualquier entorno.

---

## 1. Recuperar contraseña olvidada

### Paso 1 — Solicitar el código

```
POST /api/v1/pro/forgot-password
Content-Type: application/json

{ "email": "juan@example.com" }
```

**Siempre** responde `200` con el mismo mensaje genérico, exista o no la
cuenta (protección anti-enumeración — no reveles esto al usuario, es
intencional):

```json
{ "message": "Si existe una cuenta con este email, recibirás un código de restablecimiento en breve." }
```

La UI debe mostrar exactamente ese tipo de copy ("si existe una cuenta...")
y NO "hemos enviado tu código" — no sabemos si existe.

Errores posibles:
| status | body | cuándo |
|---|---|---|
| 400 | `{ "error": "Social authentication account", "message": "Esta cuenta usa autenticación con Google..." }` | la cuenta se registró con Google (no tiene password) |
| 400 | `{ "error": "Validation error", ... }` | email con formato inválido (validación Joi) |
| 429 | `{ "error": "Too many authentication attempts", ... }` | rate limit (`authRateLimiter`) |
| 500 | `{ "error": "Failed to send email", ... }` | Resend falló al enviar |

### Paso 2 — Confirmar código + nueva contraseña

```
POST /api/v1/pro/reset-password
Content-Type: application/json

{
  "email": "juan@example.com",
  "code": "123456",
  "newPassword": "unaContraseñaSegura123"
}
```

Reglas de validación a espejar en el cliente (evita round-trips inútiles):
- `code`: exactamente 6 dígitos numéricos.
- `newPassword`: mínimo 8 caracteres.

Éxito (`200`):
```json
{ "message": "Contraseña restablecida correctamente. Ya puedes iniciar sesión." }
```

**Importante: esta respuesta NO trae token.** No hay auto-login. Después de
un reset exitoso, redirige a `/pro/login` (o la ruta de login que exista) —
no asumas sesión iniciada.

Errores:
| status | body | cuándo |
|---|---|---|
| 400 | `{ "error": "Invalid reset code", "message": "La combinación de email y código es inválida o expiró" }` | email/código no coinciden |
| 400 | `{ "error": "Code expired", "message": "El código expiró, solicita uno nuevo" }` | pasaron los 15 min de validez |
| 400 | `{ "error": "Social authentication account", ... }` | cuenta Google |
| 400 | `{ "error": "Validation error", ... }` | Joi (code no son 6 dígitos, password <8, etc.) |
| 429 | rate limit | igual que arriba |

El código expira en 15 minutos. No existe reenvío específico de código de
reset (el usuario simplemente vuelve a pedir `forgot-password`, que genera
uno nuevo y pisa el anterior).

### Cambiar contraseña estando logueado

```
PUT /api/v1/pro/me/password
Authorization: Bearer <token pro>
Content-Type: application/json

{ "currentPassword": "...", "newPassword": "..." }
```

`newPassword` mínimo 8. Cuentas Google (`autenticacion_social`) responden 400.
Contraseña actual incorrecta: 401. El flujo de olvidada sigue existiendo
(`POST /forgot-password` + `POST /reset-password`).

---

## 2. Eliminar cuenta completamente

```
DELETE /api/v1/pro/me
Authorization: Bearer <token pro>
Content-Type: application/json
```

El body depende del tipo de cuenta — **consulta primero `GET /me`** y mira
el campo `autenticacion_social` para decidir qué formulario mostrar:

**Cuenta con contraseña propia** (`autenticacion_social: false`):
```json
{ "password": "laContraseñaActual" }
```

**Cuenta creada con Google** (`autenticacion_social: true`, sin password):
```json
{ "confirmarEmail": "juan@example.com" }
```
(debe coincidir exactamente —case-insensitive— con el email de la cuenta;
pídele al usuario que lo escriba a mano, no lo prellenes).

Nombres de campo exactos (no traducir/renombrar): `password`, `confirmarEmail`
(en español, con esa capitalización — no `confirmEmail` ni `email`).

Éxito (`200`):
```json
{ "message": "Cuenta eliminada correctamente" }
```

**Tras un 200, el token deja de servir de inmediato** (la fila ya no existe,
cualquier request posterior con ese token da 401). El frontend debe, en el
mismo flujo que procesa el 200: borrar el token guardado (localStorage /
cookie / store de auth) y redirigir fuera del dashboard (a home o a una
pantalla de "cuenta eliminada"), sin esperar un signal aparte del backend.

Errores:
| status | body | cuándo | UX sugerida |
|---|---|---|---|
| 400 | `{ "error": "Password required", "message": "Confirma tu contraseña actual para eliminar la cuenta" }` | falta `password` en cuenta no-social | mostrar el campo, no debería pasar si el form es correcto |
| 401 | `{ "error": "Invalid password", "message": "Contraseña incorrecta" }` | password no coincide | mensaje inline en el campo, permitir reintentar |
| 400 | `{ "error": "Confirmation required", "message": "Escribe tu email para confirmar la eliminación" }` | `confirmarEmail` falta o no coincide (cuenta Google) | mensaje inline |
| 400 | `{ "error": "Validation error", ... }` | body sin `password` NI `confirmarEmail` (falla Joi antes de llegar al controller) | no debería pasar si el form siempre manda uno de los dos |
| 502 | `{ "error": "Stripe cancellation failed", "message": "No se pudo cancelar tu suscripción activa. Intenta de nuevo o contacta soporte." }` | falló la cancelación en Stripe — la cuenta NO se borró | mostrar error y botón de reintentar; sugerir contactar soporte si persiste |
| 429 | rate limit (`authRateLimiter`) | varios intentos seguidos | "espera un minuto e intenta de nuevo" |
| 500 | error genérico | fallo inesperado | mensaje genérico de error |

### UX recomendada (danger zone)

1. Sección "Eliminar cuenta" en configuración del dashboard, separada
   visualmente (típico "danger zone" — borde/color de advertencia).
2. Al hacer clic, modal de confirmación que explica QUÉ se borra
   irreversiblemente: perfil público, redes sociales, estadísticas,
   suscripción activa (se cancela, no solo se pausa), galería. Deja claro que
   es irreversible.
3. Dentro del modal, el campo de confirmación (password o email según
   `autenticacion_social`).
4. Botón de confirmar deshabilitado hasta que el campo tenga contenido.
5. Loading state durante el request (puede tardar: cancela Stripe + limpia
   Storage antes de responder).
6. En éxito: limpiar sesión + redirigir. En error 502 de Stripe: dejar claro
   que la cuenta sigue activa y no se perdió nada.

---

## Prompt listo para pasarle a la sesión que trabaje el frontend

Copia y pega esto (ajusta rutas/framework si no coinciden con el repo real —
son solo mi mejor suposición, no confirmadas):

```
Necesito implementar dos features en el frontend del módulo Pro (área de
profesionales) contra una API Express ya existente y funcionando. NO
modifiques el backend, solo el frontend. Aquí está el contrato completo,
verificado contra el código real del backend — respeta los nombres de campo
EXACTOS (están en español, no los traduzcas al inglés):

═══════════════════════════════════════════════════════════════
1) RECUPERAR CONTRASEÑA OLVIDADA (profesional)
═══════════════════════════════════════════════════════════════

Paso A — Pantalla "¿Olvidaste tu contraseña?": un input de email.

  POST /api/v1/pro/forgot-password
  Body: { "email": string }

  SIEMPRE responde 200 con el mismo mensaje genérico, exista o no la
  cuenta (es anti-enumeración, intencional — el copy de la UI debe decir
  algo tipo "si existe una cuenta con este email, te llegará un código",
  NUNCA "te enviamos un código" a secas).

  Respuesta 200: { "message": "..." }
  Errores:
    400 { error: "Social authentication account", message }
       → la cuenta es de Google, no tiene password. Mostrar mensaje y
         sugerir "inicia sesión con Google".
    400 { error: "Validation error", ... } → email inválido
    429 { error: "Too many authentication attempts", ... } → rate limit,
         mostrar "intenta de nuevo en un minuto"
    500 { error: "Failed to send email", ... }

Paso B — Pantalla "Ingresa el código": inputs para código (6 dígitos) +
nueva contraseña (+ confirmar contraseña, validación solo de UI).

  POST /api/v1/pro/reset-password
  Body: {
    "email": string,
    "code": string,     // exactamente 6 dígitos numéricos
    "newPassword": string  // mínimo 8 caracteres
  }

  Validar en cliente ANTES de enviar (evita round-trips):
    - code: regex ^[0-9]{6}$
    - newPassword: length >= 8

  Éxito 200: { "message": "..." } — OJO: esta respuesta NO trae token,
  NO hay auto-login. Tras el éxito, redirige a la pantalla de login del
  módulo Pro, no asumas sesión iniciada.

  Errores:
    400 { error: "Invalid reset code", message } → email/código no
         coinciden, mostrar error y dejar reintentar
    400 { error: "Code expired", message } → el código expiró (15 min),
         ofrecer botón "solicitar uno nuevo" que vuelve al Paso A
    400 { error: "Social authentication account", ... }
    400 { error: "Validation error", ... }
    429 rate limit

  NOTA: no existe un endpoint de "cambiar contraseña" para un usuario ya
  logueado — solo este flujo de contraseña olvidada. No inventes una
  llamada a un endpoint que no está en este contrato.

═══════════════════════════════════════════════════════════════
2) ELIMINAR CUENTA (profesional, desde el dashboard, autenticado)
═══════════════════════════════════════════════════════════════

Sección "Eliminar cuenta" en configuración/ajustes del profesional
(estilo "danger zone", visualmente separada y con advertencia).

Antes de armar el formulario, consulta el perfil actual (endpoint ya
existente GET /api/v1/pro/me, requiere Authorization: Bearer <token>) y
mira el campo booleano "autenticacion_social" de la respuesta para saber
qué variante de formulario mostrar:

  - Si autenticacion_social es false (cuenta con password propio):
    mostrar un input de "contraseña actual" (tipo password).
  - Si autenticacion_social es true (cuenta de Google, sin password):
    mostrar un input de texto donde el usuario escribe su propio email
    para confirmar (NO lo prellenes tú, que lo tipee).

Flujo:
  1. Modal de confirmación explicando qué se borra IRREVERSIBLEMENTE:
     perfil público, redes sociales, estadísticas/analytics, la
     suscripción activa (se CANCELA en Stripe, no se pausa), galería.
  2. El campo correspondiente (password o email) dentro del modal.
  3. Botón de confirmar deshabilitado hasta que el campo tenga contenido.
  4. Al confirmar:

  DELETE /api/v1/pro/me
  Headers: Authorization: Bearer <token pro>
  Body (cuenta con password):     { "password": string }
  Body (cuenta Google):           { "confirmarEmail": string }

  (nombres de campo EXACTOS: "password" y "confirmarEmail" — este último
  en español, con esa capitalización exacta, no "confirmEmail")

  Éxito 200: { "message": "Cuenta eliminada correctamente" }

  MUY IMPORTANTE: en el mismo momento que recibas este 200, borra el
  token guardado (localStorage/cookie/store de auth, lo que use este
  frontend) y redirige fuera del dashboard — el token ya no sirve para
  nada, cualquier request posterior con él dará 401 porque la cuenta ya
  no existe en la base de datos.

  Errores:
    400 { error: "Password required", message }
       → el form no mandó password en una cuenta que sí lo requiere
    401 { error: "Invalid password", message: "Contraseña incorrecta" }
       → mostrar error inline en el campo, permitir reintentar
    400 { error: "Confirmation required", message }
       → el email escrito no coincide (cuenta Google)
    400 { error: "Validation error", ... }
       → no se mandó ni password ni confirmarEmail
    502 { error: "Stripe cancellation failed", message }
       → falló cancelar la suscripción en Stripe. LA CUENTA NO SE
         BORRÓ, sigue activa. Mostrar error claro ("no se pudo procesar,
         intenta de nuevo o contacta soporte") y permitir reintentar —
         no asumas que algo se eliminó parcialmente.
    429 { error: "Too many authentication attempts", ... }
       → rate limit, "espera un minuto e intenta de nuevo"
    500 → error genérico

  El request puede tardar más de lo normal (cancela Stripe + limpia
  archivos de Storage antes de responder) — muestra un loading/spinner
  claro y deshabilita el botón de confirmar mientras está en vuelo.

═══════════════════════════════════════════════════════════════

Usa el mismo patrón de manejo de errores/loading/toasts que ya existe en
el resto del dashboard de profesionales de este frontend (revisa cómo
están hechas las pantallas de login/registro del módulo Pro para seguir
la misma convención visual y de componentes — no introduzcas un patrón
nuevo de formularios/errores si ya hay uno establecido).
```
