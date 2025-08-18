# Opciones de Entrega del Carrito

## Resumen
Se han agregado opciones de entrega personalizables para cada item del carrito, permitiendo a los usuarios especificar:
- **Hora de entrega preferida**: Entre 12:00 PM y 10:00 PM (22:00)
- **Método de entrega**: Puerta, manos, o recepción
- **Notas de entrega**: Instrucciones adicionales (máximo 500 caracteres)

## Nuevas Columnas de la Base de Datos

```sql
-- Ejecutar en Supabase SQL Console
ALTER TABLE carrito 
ADD COLUMN hora_entrega_preferida VARCHAR(5) DEFAULT '18:00';

ALTER TABLE carrito 
ADD COLUMN metodo_entrega VARCHAR(20) DEFAULT 'puerta'
CHECK (metodo_entrega IN ('puerta', 'manos', 'recepcion'));

ALTER TABLE carrito 
ADD COLUMN notas_entrega TEXT;
```

## API Endpoints

### PUT /api/cart/delivery-options
Actualiza las opciones de entrega para items del carrito.

**Parámetros del Body:**
```json
{
  "horaEntregaPreferida": "18:00",    // Opcional, por defecto "18:00"
  "metodoEntrega": "puerta",          // Opcional, valores: "puerta", "manos", "recepcion"
  "notasEntrega": "Tocar el timbre",  // Opcional, máximo 500 caracteres
  "aplicarATodos": true               // Opcional, por defecto true (una sola entrega para todo el carrito)
}
```

**Validaciones:**
- `horaEntregaPreferida`: Formato HH:MM, entre 12:00 y 22:00
- `metodoEntrega`: Solo valores permitidos: 'puerta', 'manos', 'recepcion'
- `notasEntrega`: Máximo 500 caracteres
- `aplicarATodos`: Boolean, por defecto true

**Respuesta de éxito:**
```json
{
  "message": "Delivery options updated for entire cart",
  "updatedItems": 3,
  "deliveryOptions": {
    "horaEntregaPreferida": "18:00",
    "metodoEntrega": "puerta",
    "notasEntrega": "Tocar el timbre"
  }
}
```

## Comportamiento de la Funcionalidad

### Aplicar a Todo el Carrito (`aplicarATodos: true` - Por Defecto)
- Actualiza **todos** los items del carrito del usuario
- Sobrescribe cualquier configuración anterior
- **Comportamiento recomendado**: Una sola entrega para todo el pedido

### Aplicar Solo por Defecto (`aplicarATodos: false` - Uso Avanzado)
- Solo actualiza items que **no tienen** configuración específica
- Preserva configuraciones personalizadas existentes
- **Uso especial**: Para casos donde se requieren entregas parciales

## Métodos de Entrega

| Valor | Descripción |
|-------|-------------|
| `puerta` | Dejar el pedido en la puerta |
| `manos` | Entregar directamente en mano |
| `recepcion` | Dejar en recepción/portería |

## Horarios de Entrega

- **Rango permitido**: 12:00 PM - 10:00 PM (22:00)
- **Formato**: HH:MM (24 horas)
- **Por defecto**: 18:00 (6:00 PM)

## Ejemplos de Uso

### 1. Configurar entrega para las 7 PM en puerta (comportamiento por defecto)
```bash
curl -X PUT http://localhost:3000/api/cart/delivery-options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "horaEntregaPreferida": "19:00",
    "metodoEntrega": "puerta",
    "notasEntrega": "Departamento 3B"
  }'
```

### 2. Configurar entrega específica para todo el carrito antes del checkout
```bash
curl -X PUT http://localhost:3000/api/cart/delivery-options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "horaEntregaPreferida": "20:00",
    "metodoEntrega": "manos",
    "notasEntrega": "Llamar al llegar, apartamento en segundo piso"
  }'
```

## Notas de Implementación

- Las opciones se aplican por item del carrito, no por pedido completo
- Se mantiene compatibilidad con items existentes (valores por defecto)
- La validación se ejecuta tanto en el middleware como en el controller
- Se incluyen índices de base de datos para optimizar consultas
- Todas las rutas requieren autenticación

## Próximos Pasos

1. Ejecutar las consultas SQL en Supabase para agregar las columnas
2. Probar los endpoints con diferentes configuraciones
3. Implementar la interfaz de usuario para seleccionar opciones
4. Integrar con el proceso de checkout y órdenes
