# Stripe API Routes

Ubicación: `src/routes/stripe.route.js`
Controlador: `src/controllers/stripeController.js`

## Rutas Protegidas

Estas interacciones con Stripe suceden bajo el concepto de Checkout y requieren un pago asociado a un usuario (`authMiddleware`).

| Método | Endpoint | Acción | Validaciones Especiales |
|---|---|---|---|
| `POST` | `/api/v1/stripe/checkout/create-session` | Iniciar una sesión de Checkout en Stripe | `validateRequest(createCheckoutSessionSchema)` |
| `GET` | `/api/v1/stripe/checkout/session-status/:sessionId` | Consultar estado actual del Checkout en Stripe | |
| `POST` | `/api/v1/stripe/refund` | Emitir un reembolso desde backend | `validateRequest(createRefundSchema)` |

## Webhooks

**Importante:** El endpoint exacto de webhook original (`/webhook`) debe capturarse en el servidor (`server.js`) ANTES de que termine de parsear toda la solicitud en un JSON convencional (se lee en *raw body* desde `express.raw`), ya que Stripe requiere la firma criptográfica original sin alteraciones. Este archivo de rutas solo trata interacciones *on-demand*.
