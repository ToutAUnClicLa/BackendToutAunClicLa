# Auth API Routes

Ubicación: `src/routes/auth.route.js`
Controlador: `src/controllers/authController.js`

**Nota:** Varias rutas cuentan con limitador de tasa de peticiones (`authRateLimiter`) para prevenir abusos.

## Rutas

| Método | Endpoint | Acción | Middlewares |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Registrar nuevo usuario | `authRateLimiter`, `validateRequest(userRegisterSchema)` |
| `POST` | `/api/v1/auth/login` | Iniciar sesión | `authRateLimiter`, `validateRequest(userLoginSchema)` |
| `POST` | `/api/v1/auth/google` | Autenticación vía Google | `authRateLimiter`, `validateRequest(googleAuthSchema)` |
| `GET` | `/api/v1/auth/google/callback` | Callback de Google OAuth | (Ninguno) |
| `POST` | `/api/v1/auth/verify-email` | Verificar email | `authRateLimiter`, `validateRequest(verificationCodeSchema)` |
| `POST` | `/api/v1/auth/resend-verification` | Reenviar código de verificación | `authRateLimiter`, `validateRequest(resendVerificationSchema)` |
| `POST` | `/api/v1/auth/verification-status` | Revisar estado de verificación | `authRateLimiter`, `validateRequest(emailCheckSchema)` |
| `POST` | `/api/v1/auth/forgot-password` | Solicitar reseteo de contraseña | `authRateLimiter`, `validateRequest(forgotPasswordSchema)` |
| `POST` | `/api/v1/auth/reset-password` | Resetear contraseña | `authRateLimiter`, `validateRequest(resetPasswordSchema)` |
| `GET` | `/api/v1/auth/profile` | Obtener perfil del usuario autenticado| `authMiddleware` |

## Detalles Destacados

- **Google OAuth:** Utiliza validación de `access_token` e interactúa directamente en el callback sin un rate limit fuerte para no bloquear las confirmaciones de flujos de 3ros.
- **Validación Específica:** Diferentes esquemas Joi (`userRegisterSchema`, `userLoginSchema`, `resetPasswordSchema`, etc.) para asegurar que la información entrante a cada endpoint sea estructurada y segura.
