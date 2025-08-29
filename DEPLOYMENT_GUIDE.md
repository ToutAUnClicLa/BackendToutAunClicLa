# 🚀 Guía de Despliegue - ToutAunClicLa Backend

## 📋 Configuración de Entornos

El sistema está configurado para manejar automáticamente dos entornos:
- **Desarrollo** (local)
- **Producción** (host)

### 🔧 Desarrollo (Local)

Las variables se cargan desde `.env.development.local`:
```bash
NODE_ENV=development
# El resto de variables están en el archivo
```

### 🚀 Producción (Host)

Configura estas variables en tu host:

```bash
# IMPORTANTE: Configurar en el panel de tu hosting
NODE_ENV=production
PORT=5500

# Supabase (mismo para ambos entornos)
SUPABASE_URL=https://fthunnrkcpzygyspynus.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# JWT (mismo)
JWT_SECRET="yhSDK/S+LSTF3aZc8nwsIfq18fJd1PDtw9kLjwfTOqS2x05VtATva5yfZrIifjEgapGW7EXgSko5BE4bjd8msA=="

# ⚠️ STRIPE - IMPORTANTE PARA PRODUCCIÓN
# Opción A: Mantener TEST (para pruebas)
STRIPE_PUBLISHABLE_KEY=pk_test_51RMfRYC09Hbp0X9k...
STRIPE_SECRET_KEY=sk_test_51RMfRYC09Hbp0X9k...
STRIPE_WEBHOOK_SECRET=whsec_... # ← NECESITAS CREAR NUEVO WEBHOOK

# Opción B: Usar LIVE (pagos reales)
# STRIPE_PUBLISHABLE_KEY=pk_live_... ← Obtener de Stripe Dashboard
# STRIPE_SECRET_KEY=sk_live_... ← Obtener de Stripe Dashboard
# STRIPE_WEBHOOK_SECRET=whsec_... ← Crear nuevo webhook

# Frontend URL
FRONTEND_URL=https://www.toutaunclicla.com

# Resend (emails)
RESEND_API_KEY=yre_GJSd1dDu_Q6h3iJJzzzmXR2ym3YJM2dHJ

# Admin emails
ADMIN_EMAILS=presidence@toutaunclicla.com,serviceclient@toutaunclicla.com

# Google OAuth
GOOGLE_CLIENT_ID=556447184562-hr8ur4qofs1ju18rggbtanlt0t1upkgj.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://www.toutaunclicla.com/api/v1/auth/google/callback

# Arcjet (opcional)
ARCJET_KEY=ajkey_01jxxcdm6nf3vr3784712e4dwz
```

## 💳 Configuración de Stripe

### Para Stripe TEST en Producción:

1. **Ir a Stripe Dashboard** (modo TEST)
2. **Crear nuevo webhook**:
   - URL: `https://www.toutaunclicla.com/api/v1/stripe/webhook`
   - Eventos a escuchar:
     - `checkout.session.completed`
     - `checkout.session.expired`
3. **Copiar el Webhook Secret** y agregarlo como `STRIPE_WEBHOOK_SECRET`

### Para Stripe LIVE (Pagos Reales):

1. **Activar cuenta en Stripe** (completar verificación)
2. **Obtener keys de producción** del Dashboard
3. **Crear webhook de producción** con misma URL
4. **Actualizar variables** en el host

## 📧 Configuración de Emails

El sistema detecta automáticamente el entorno:

- **Desarrollo**: Emails con prefijo `[TEST]` desde `test@toutaunclicla.com`
- **Producción**: Emails normales desde `serviceclient@toutaunclicla.com`

### Verificar configuración de dominio:

1. **SPF Record** en DNS:
   ```
   v=spf1 include:amazonses.com ~all
   ```

2. **DKIM**: Configurar en Resend Dashboard

3. **DMARC** (opcional):
   ```
   v=DMARC1; p=none; rua=mailto:admin@toutaunclicla.com
   ```

## 🔍 Verificación Post-Despliegue

### 1. Verificar logs al iniciar:
```
🚀 Running in PRODUCTION mode
💳 Stripe initialized in TEST/LIVE mode
📧 Email service configured for PRODUCTION
```

### 2. Si ves advertencias:
```
⚠️ WARNING: Production server using Stripe TEST mode!
```
Significa que estás usando keys de prueba en producción.

### 3. Probar flujo completo:
1. Hacer un pedido de prueba
2. Verificar que llegue el webhook
3. Confirmar emails enviados

## 🐛 Troubleshooting

### Emails no llegan:

1. **Verificar logs del servidor**
2. **Revisar Dashboard de Resend**
3. **Confirmar ADMIN_EMAILS configurado**
4. **Verificar webhook de Stripe**

### Webhook no funciona:

1. **Verificar STRIPE_WEBHOOK_SECRET**
2. **Confirmar URL del webhook en Stripe**
3. **Revisar logs: "Webhook verificado"`
4. **Test con Stripe CLI**:
   ```bash
   stripe listen --forward-to localhost:5500/api/v1/stripe/webhook
   ```

### Órdenes no se crean:

1. **Verificar conexión a Supabase**
2. **Confirmar webhook recibido**
3. **Revisar logs de `createOrderFromCheckoutSession`**

## 📝 Comandos Útiles

### Desarrollo:
```bash
npm run dev
```

### Producción:
```bash
npm start
# o
NODE_ENV=production node src/server.js
```

### Test de emails:
```bash
node test-emails.js
```

## ✅ Checklist de Despliegue

- [ ] Variables de entorno configuradas en host
- [ ] NODE_ENV=production
- [ ] Webhook de Stripe configurado
- [ ] DNS/SPF/DKIM para emails
- [ ] Frontend URL correcto
- [ ] Admin emails configurados
- [ ] Google OAuth redirect URI actualizado
- [ ] Logs monitoreados
- [ ] Prueba de compra completa

## 🔐 Seguridad

- **NUNCA** subir archivos `.env` a git
- **Rotar** keys periódicamente
- **Monitorear** logs de errores
- **Backup** de base de datos regular
- **HTTPS** obligatorio en producción

## 📞 Soporte

Si hay problemas con el despliegue:
1. Revisar logs del servidor
2. Verificar configuración de variables
3. Confirmar webhooks en Stripe Dashboard
4. Revisar Dashboard de Resend para emails