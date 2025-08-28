# Guía de Integración - Sistema de Entregas Flexible

Esta guía explica cómo integrar el frontend con el nuevo sistema de entregas flexible del backend ToutAunClicLa.

## Conceptos Principales

### Tipos de Entrega
- **`hoy`**: Entrega el mismo día (debe pedirse al menos 1 hora antes)
- **`siguiente_dia`**: Entrega al día siguiente

### Horarios de Operación
- **Entregas**: 11:00 AM - 9:00 PM
- **Último pedido para hoy**: 8:00 PM (debe pedirse 1 hora antes)
- **Corte para día siguiente**: Después de las 8:00 PM, solo disponible día siguiente

## Endpoints Actualizados

### 1. Agregar Producto al Carrito
**POST** `/api/v1/cart/add`

```json
{
  "productId": 123,
  "quantity": 2,
  "horaEntregaPreferida": "14:00",
  "tipoEntrega": "hoy",
  "metodoEntrega": "puerta",
  "notasEntrega": "Tocar el timbre dos veces"
}
```

### 2. Actualizar Item del Carrito
**PUT** `/api/v1/cart/item/:id`

```json
{
  "quantity": 1,
  "horaEntregaPreferida": "16:30",
  "tipoEntrega": "siguiente_dia",
  "metodoEntrega": "recepcion",
  "notasEntrega": "Dejar con el conserje"
}
```

### 3. Actualizar Opciones de Entrega (Todo el Carrito)
**PUT** `/api/v1/cart/delivery-options`

```json
{
  "horaEntregaPreferida": "18:00",
  "tipoEntrega": "hoy",
  "metodoEntrega": "manos",
  "notasEntrega": "Llamar al llegar",
  "aplicarATodos": true
}
```

## Comportamiento del Sistema

### Validación Automática

El backend **respeta** la elección del frontend pero valida que sea posible:

1. **Si frontend envía `tipoEntrega: "hoy"`:**
   - ✅ Válido si hay horarios disponibles hoy
   - ❌ Error si ya es muy tarde (después de 8:00 PM)
   - 📋 Retorna horarios disponibles si la hora solicitada no está disponible

2. **Si frontend envía `tipoEntrega: "siguiente_dia"`:**
   - ✅ Siempre válido con horarios 11:00 AM - 9:00 PM
   - 📋 Retorna todos los horarios disponibles mañana

3. **Si frontend NO envía `tipoEntrega`:**
   - 🤖 Backend sugiere basado en hora actual y hora preferida
   - 📋 Retorna el tipo sugerido en la respuesta

### Respuestas de Validación

#### ✅ Exitosa
```json
{
  "message": "Item added to cart successfully",
  "cartItem": { ... },
  "deliveryInfo": {
    "type": "hoy",
    "description": "Entrega estándar (2-3 días hábiles)"
  }
}
```

#### ❌ Error con Alternativas
```json
{
  "error": "Invalid delivery configuration",
  "message": "Time 13:00 not available today. Next available slot is 1 hour from now.",
  "availableHours": ["14:00", "14:30", "15:00", "15:30", ... "20:00"]
}
```

#### ❌ Sin Horarios Disponibles Hoy
```json
{
  "error": "Invalid delivery configuration", 
  "message": "No delivery slots available today. Orders must be placed 1 hour before delivery and last delivery is at 9:00 PM.",
  "availableHours": [],
  "suggestTomorrow": true
}
```

## Mejores Prácticas Frontend

### 1. Consultar Horarios Disponibles

```javascript
// Función para obtener horarios disponibles según el tipo
const getAvailableHours = async (deliveryType) => {
  try {
    // Hacer una petición de prueba para obtener horarios
    const response = await fetch('/api/v1/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: 1, // ID temporal para consulta
        quantity: 1,
        tipoEntrega: deliveryType,
        horaEntregaPreferida: "12:00" // Hora base para consulta
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      return error.availableHours || [];
    }
  } catch (error) {
    console.error('Error al consultar horarios:', error);
    return [];
  }
};
```

### 2. Interfaz Recomendada

```html
<!-- Selector de Tipo de Entrega -->
<div class="delivery-type-selector">
  <input type="radio" id="today" name="deliveryType" value="hoy">
  <label for="today">Entrega Hoy</label>
  
  <input type="radio" id="tomorrow" name="deliveryType" value="siguiente_dia">
  <label for="tomorrow">Entrega Mañana</label>
</div>

<!-- Selector de Hora (dinámico según tipo) -->
<select id="deliveryTime">
  <!-- Opciones generadas dinámicamente -->
</select>

<!-- Método de Entrega -->
<select id="deliveryMethod">
  <option value="puerta">En la puerta</option>
  <option value="manos">En mano</option>
  <option value="recepcion">En recepción</option>
</select>
```

### 3. Lógica de Validación Frontend

```javascript
const validateAndSubmit = async (formData) => {
  try {
    const response = await fetch('/api/v1/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (error.availableHours) {
        // Mostrar horarios alternativos al usuario
        showAlternativeHours(error.availableHours);
        return;
      }
      
      if (error.suggestTomorrow) {
        // Sugerir cambiar a entrega de mañana
        suggestTomorrowDelivery();
        return;
      }
      
      throw new Error(error.message);
    }

    const result = await response.json();
    showSuccess(result.deliveryInfo);
    
  } catch (error) {
    showError(error.message);
  }
};
```

## Campos Requeridos vs Opcionales

### Requeridos
- `productId`: ID del producto
- `quantity`: Cantidad
- `horaEntregaPreferida`: Hora preferida (formato HH:MM)

### Opcionales
- `tipoEntrega`: "hoy" | "siguiente_dia" (si no se envía, el backend sugiere)
- `metodoEntrega`: "puerta" | "manos" | "recepcion" (default: "puerta")
- `notasEntrega`: String con instrucciones especiales (max 500 chars)

## Métodos de Entrega

| Valor | Descripción |
|-------|-------------|
| `puerta` | Dejar en la puerta/entrance |
| `manos` | Entregar en mano directamente |
| `recepcion` | Dejar en recepción/conserjería |

## Casos de Uso Comunes

### 1. Pedido Urgente para Hoy
```javascript
const urgentOrder = {
  productId: 123,
  quantity: 1,
  tipoEntrega: "hoy",
  horaEntregaPreferida: getCurrentTime() + 1 hour, // Mínimo 1 hora
  metodoEntrega: "manos"
};
```

### 2. Pedido Programado para Mañana
```javascript
const scheduledOrder = {
  productId: 456,
  quantity: 2,
  tipoEntrega: "siguiente_dia",
  horaEntregaPreferida: "11:00", // Cualquier hora 11:00-21:00
  metodoEntrega: "recepcion",
  notasEntrega: "Apartamento 4B"
};
```

### 3. Actualizar Todo el Carrito
```javascript
const updateAllItems = {
  horaEntregaPreferida: "15:30",
  tipoEntrega: "siguiente_dia",
  metodoEntrega: "puerta",
  aplicarATodos: true // Aplicar a todos los items
};
```

## Códigos de Error Comunes

| Código | Mensaje | Acción Recomendada |
|--------|---------|-------------------|
| 400 | Invalid delivery configuration | Mostrar horarios alternativos |
| 400 | Time not available today | Ofrecer horarios disponibles |
| 400 | No delivery slots available today | Sugerir entrega mañana |
| 400 | Delivery hours are 11:00 AM - 9:00 PM | Corregir hora fuera de rango |

## Notas Importantes

1. **Tiempo Mínimo**: Siempre debe haber mínimo 1 hora entre el pedido y la entrega
2. **Corte Diario**: Después de las 8:00 PM, no hay entregas disponibles para hoy
3. **Flexibilidad**: El backend respeta la elección del frontend pero sugiere alternativas
4. **Validación en Tiempo Real**: Consultar disponibilidad antes de enviar el formulario
5. **Experiencia de Usuario**: Siempre mostrar horarios alternativos en caso de error

## Flujo Recomendado

1. Usuario selecciona tipo de entrega (hoy/mañana)
2. Frontend consulta horarios disponibles
3. Usuario elige hora específica
4. Frontend envía petición con todos los datos
5. Backend valida y responde con confirmación o alternativas
6. Frontend maneja la respuesta apropiadamente

Esta implementación garantiza una experiencia fluida mientras mantiene la flexibilidad del sistema de entregas.