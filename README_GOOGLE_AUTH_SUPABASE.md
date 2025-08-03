# Autenticación con Google usando Supabase

Este proyecto ahora utiliza Supabase Auth para manejar la autenticación con Google en lugar de implementar OAuth directamente.

## Configuración en Supabase Dashboard

### 1. Configurar el proveedor de Google

1. Ve a tu proyecto de Supabase Dashboard
2. Navega a `Authentication` > `Providers`
3. Busca `Google` y haz clic en el interruptor para habilitarlo
4. Completa la configuración:
   - **Client ID**: Tu Google OAuth Client ID
   - **Client Secret**: Tu Google OAuth Client Secret

### 2. Configurar URLs de redirección

En la sección de configuración de Google, asegúrate de agregar las siguientes URLs de redirección:

```
http://localhost:3000/auth/callback (para desarrollo)
https://tu-dominio.com/auth/callback (para producción)
```

### 3. Configurar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto o crea uno nuevo
3. Ve a `APIs & Services` > `Credentials`
4. Crea una nueva credencial de tipo "OAuth 2.0 Client ID"
5. Configura las URLs autorizadas:
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (desarrollo)
     - `https://tu-dominio.com` (producción)
   - **Authorized redirect URIs**:
     - `https://tu-proyecto.supabase.co/auth/v1/callback` (Supabase)
     - `http://localhost:3000/auth/callback` (tu frontend)

## Implementación en el Frontend

### Opción 1: Usando Supabase Client (Recomendado)

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Iniciar autenticación con Google
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost:3000/auth/callback'
    }
  })
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  // El usuario será redirigido a Google para autenticarse
}

// En tu página de callback (/auth/callback)
const handleAuthCallback = async () => {
  const { data, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  if (data.session) {
    // Enviar tokens al backend
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      })
    })
    
    const result = await response.json()
    
    if (result.token) {
      // Guardar JWT personalizado
      localStorage.setItem('token', result.token)
      // Redirigir al dashboard
      window.location.href = '/dashboard'
    }
  }
}
```

### Opción 2: Usando el endpoint de callback

Si prefieres manejar todo en el backend:

```javascript
// Redirigir directamente a Supabase OAuth
const signInWithGoogle = () => {
  window.location.href = `https://tu-proyecto.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent('http://localhost:5500/api/auth/google/callback')}`
}
```

## Endpoints de la API

### POST /api/auth/google

Autentica un usuario usando tokens de Supabase.

**Request:**
```json
{
  "access_token": "token_de_acceso_de_supabase",
  "refresh_token": "token_de_refresh_de_supabase" // opcional
}
```

**Response:**
```json
{
  "message": "Google authentication successful",
  "token": "jwt_personalizado",
  "supabaseSession": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1234567890
  },
  "user": {
    "id": "usuario_id",
    "email": "usuario@ejemplo.com",
    "nombre": "Nombre Usuario",
    "verified": true,
    "socialAuth": true,
    "provider": "google"
  }
}
```

### GET /api/auth/google/callback

Maneja el callback de OAuth directamente en el backend.

**Query Parameters:**
- `code`: Código de autorización de Google
- `state`: Estado opcional para verificación

## Flujo de Autenticación

1. **Frontend**: Usuario hace clic en "Iniciar sesión con Google"
2. **Redirect**: Usuario es redirigido a Google OAuth
3. **Google**: Usuario autoriza la aplicación
4. **Supabase**: Google redirige a Supabase con el código
5. **Supabase**: Crea una sesión y redirige al frontend
6. **Frontend**: Extrae los tokens de la sesión de Supabase
7. **Backend**: Valida los tokens y crea/actualiza el usuario
8. **Response**: Retorna JWT personalizado y datos del usuario

## Ventajas de usar Supabase Auth

1. **Seguridad**: Supabase maneja toda la complejidad de OAuth
2. **Escalabilidad**: Soporte nativo para múltiples proveedores
3. **Mantenimiento**: Menos código para mantener
4. **Features**: Row Level Security (RLS) y políticas avanzadas
5. **Consistencia**: Mismo sistema para todos los proveedores sociales

## Variables de Entorno

Ya no necesitas estas variables en tu backend:
- ~~`GOOGLE_CLIENT_ID`~~ (ahora se configura en Supabase)
- ~~`GOOGLE_CLIENT_SECRET`~~ (ahora se configura en Supabase)

Las configuraciones de Google ahora se manejan completamente en el dashboard de Supabase.

## Notas Importantes

1. Los usuarios creados con Google tendrán `autenticacion_social: true`
2. Sus contraseñas no se almacenan en tu tabla personalizada
3. El ID de Supabase Auth se guarda en `auth_user_id` para referencia
4. Los usuarios existentes se actualizarán automáticamente al usar Google
5. El avatar de Google se sincroniza automáticamente

## Troubleshooting

### Error: "Invalid token"
- Verifica que el `access_token` de Supabase sea válido
- Asegúrate de que la sesión no haya expirado

### Error: "Code exchange failed"
- Verifica las URLs de redirección en Google Console
- Confirma que las credenciales en Supabase sean correctas

### Usuario no se crea
- Revisa los logs del servidor para errores específicos
- Verifica que la tabla `usuarios` tenga los campos necesarios
- Confirma que Supabase pueda insertar en la tabla
