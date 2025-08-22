# API de Restaurantes - Documentación

## Endpoint Principal

### Obtener Lista de Restaurantes
```
GET /api/v1/products/restaurants
```

**Descripción:** Obtiene todos los restaurantes disponibles con información de horarios, disponibilidad en tiempo real y nacionalidades.

## Respuesta de la API

### Estructura de Respuesta
```json
{
  "restaurants": [
    {
      "id": 4,
      "nombre": "L'Arepa Express",
      "Imagen": "https://...",
      "Descripcion": "Cuisine latine moderne 🇨🇴 🇻🇪...",
      "horario_apertura": "12:00:00",
      "horario_cierre": "21:00:00",
      "nacionalidades": ["Colombia", "Venezuela"],
      "categorias": {
        "id": 2,
        "nombre": "Comidas"
      },
      "abierto": true,
      "disponible": false,
      "horario_entrega": {
        "inicio": "12:00:00",
        "fin": "21:00:00"
      },
      "hora_limite_pedidos": "20:00:00"
    }
  ],
  "currentTime": "20:30:00"
}
```

## Campos de Cada Restaurante

### Información Básica
- **`id`**: ID único del restaurante
- **`nombre`**: Nombre del restaurante
- **`Imagen`**: URL de la imagen/logo del restaurante
- **`Descripcion`**: Descripción del restaurante

### Horarios
- **`horario_apertura`**: Hora de apertura (formato HH:MM:SS)
- **`horario_cierre`**: Hora de cierre (formato HH:MM:SS)
- **`horario_entrega`**: Objeto con horarios de entrega
  - `inicio`: Hora inicio de entregas
  - `fin`: Hora fin de entregas

### Estados en Tiempo Real
- **`abierto`**: `true/false` - Si el restaurante está abierto ahora
- **`disponible`**: `true/false` - Si se pueden hacer pedidos (hasta 1 hora antes del cierre)
- **`hora_limite_pedidos`**: Hora límite para hacer pedidos (1 hora antes del cierre)

### Localización
- **`nacionalidades`**: Array de países en español (ej: ["Colombia", "Venezuela"])

### Metadatos
- **`currentTime`**: Hora actual del servidor (zona horaria Montreal)

## Lógica de Disponibilidad

### Estados Posibles
1. **Cerrado**: `abierto: false, disponible: false`
2. **Abierto y Disponible**: `abierto: true, disponible: true`
3. **Abierto pero No Disponible**: `abierto: true, disponible: false` (última hora)

### Reglas de Negocio
- **Horario por defecto**: 12:00 PM - 9:00 PM
- **Zona horaria**: America/Montreal
- **Límite de pedidos**: 1 hora antes del cierre
- **Entregas**: Solo dentro del horario de operación

## Implementación en Frontend

### 1. Consumir la API
- Hacer `GET` request a `/api/v1/products/restaurants`
- No requiere autenticación
- Actualizar cada 5-10 minutos para estado en tiempo real

### 2. Mostrar Estados
- **Verde**: `disponible: true` - "Acepta pedidos"
- **Amarillo**: `abierto: true, disponible: false` - "Última hora"
- **Rojo**: `abierto: false` - "Cerrado"

### 3. Mostrar Banderas
- Usar el array `nacionalidades` para mostrar banderas de países
- Mapear nombres en español a códigos de país o imágenes

### 4. Información de Horarios
- Mostrar `horario_apertura` - `horario_cierre`
- Si `disponible: false` y `abierto: true`, mostrar "Última hora hasta [hora_limite_pedidos]"

### 5. Validaciones
- Solo permitir pedidos si `disponible: true`
- Mostrar mensaje informativo cuando `disponible: false`
- Redirigir o deshabilitar botones según disponibilidad

## Casos de Uso Comunes

### Filtrado por Disponibilidad
```javascript
// Restaurantes que aceptan pedidos ahora
const disponibles = restaurants.filter(r => r.disponible);

// Restaurantes abiertos
const abiertos = restaurants.filter(r => r.abierto);
```

### Agrupación por Nacionalidad
```javascript
// Agrupar por países
const porPais = restaurants.reduce((acc, restaurant) => {
  restaurant.nacionalidades.forEach(pais => {
    if (!acc[pais]) acc[pais] = [];
    acc[pais].push(restaurant);
  });
  return acc;
}, {});
```

### Ordenamiento Recomendado
1. Primero: `disponible: true`
2. Segundo: `abierto: true, disponible: false`
3. Último: `abierto: false`
4. Alfabético por nombre dentro de cada grupo

## Ejemplos de Implementación

### Componente de Estado del Restaurante
```javascript
function RestaurantStatus({ restaurant }) {
  if (!restaurant.abierto) {
    return <Badge color="red">Cerrado</Badge>;
  }
  
  if (restaurant.disponible) {
    return <Badge color="green">Acepta pedidos</Badge>;
  }
  
  return <Badge color="yellow">Última hora hasta {restaurant.hora_limite_pedidos}</Badge>;
}
```

### Validación antes de Hacer Pedido
```javascript
function canOrderFrom(restaurant) {
  return restaurant.abierto && restaurant.disponible;
}

function getUnavailableMessage(restaurant) {
  if (!restaurant.abierto) {
    return `Cerrado. Abre a las ${restaurant.horario_apertura}`;
  }
  
  if (!restaurant.disponible) {
    return `Ya no acepta pedidos. Última hora: ${restaurant.hora_limite_pedidos}`;
  }
  
  return "";
}
```

## Mapeo de Países a Banderas

### Países Soportados
- **Colombia** → 🇨🇴 o código "CO"
- **Venezuela** → 🇻🇪 o código "VE"
- **México** → 🇲🇽 o código "MX"
- **Argentina** → 🇦🇷 o código "AR"
- **Haití** → 🇭🇹 o código "HT"
- **Perú** → 🇵🇪 o código "PE"
- **Chile** → 🇨🇱 o código "CL"
- **Brasil** → 🇧🇷 o código "BR"

### Ejemplo de Mapeo
```javascript
const countryFlags = {
  "Colombia": "🇨🇴",
  "Venezuela": "🇻🇪",
  "México": "🇲🇽",
  "Argentina": "🇦🇷",
  "Haití": "🇭🇹"
};

function renderFlags(nacionalidades) {
  return nacionalidades.map(pais => countryFlags[pais] || "🏳️").join(" ");
}
```

## Notas Técnicas

### Zona Horaria
- Todos los horarios están en zona horaria **America/Montreal**
- El frontend debe mostrar horarios en hora local del usuario o especificar que es hora de Montreal

### Actualización en Tiempo Real
- Se recomienda actualizar la lista cada 5-10 minutos
- Implementar un indicador visual cuando los datos son antiguos
- Considerar WebSockets para actualizaciones en tiempo real si es necesario

### Manejo de Errores
- Manejar casos donde la API no esté disponible
- Mostrar estado de "cargando" mientras se obtienen los datos
- Implementar retry automático en caso de fallas de red