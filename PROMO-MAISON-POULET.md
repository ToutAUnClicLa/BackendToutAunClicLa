# Promoción Temporal: Domicilio Gratis Maison de Poulet - Riviera Sur

## Descripción de la Promoción

**Duración:** 30 y 31 de agosto 2025 (hasta las 00:00 del 1 de septiembre)

**Condiciones:**
- El carrito debe contener AL MENOS UN producto de Maison de Poulet (subcategoría ID 13)
- El código postal de entrega debe ser de la Riviera Sur
- Aplica independientemente de otros productos en el carrito
- Si se cumplen ambas condiciones, el domicilio es GRATIS ($0)

## Implementación

### Archivo Modificado 
- `/src/utils/shippingCalculator.js`

### Lógica Implementada
La promoción se evalúa al inicio de la función `calculateShippingCostAdvanced()`:

1. Verifica si la fecha actual está dentro del período de promoción
2. Verifica si hay al menos un producto con `subcategoria_id === 13`
3. Verifica si el código postal pertenece a la Riviera Sur
4. Si todas las condiciones se cumplen, retorna costo de envío $0

### Códigos Postales de Riviera Sur
Los siguientes prefijos de código postal (primeros 3 caracteres) son considerados Riviera Sur:
```
J3V, J3W, J3X, J3Y, J3Z,
J4B, J4G, J4H, J4J, J4K, J4L, J4M, J4N, J4P, J4R, J4S, J4T, J4V, J4W, J4X, J4Y, J4Z,
J5A, J5B, J5C, J5J, J5K, J5L, J5M, J5R, J5T, J5V, J5W, J5X, J5Y, J5Z
```

## Pruebas

### Ejecutar Script de Pruebas
```bash
node test-promo-maison-poulet.js
```

### Casos de Prueba Incluidos
1. ✅ Maison de Poulet + Riviera Sur = Domicilio Gratis
2. ✅ Maison de Poulet + Montreal = Domicilio Regular ($25 para pedido mixto)
3. ✅ Sin Maison de Poulet + Riviera Sur = Domicilio Regular ($10)
4. ✅ Verificación de códigos postales
5. ✅ Carrito mixto con Maison de Poulet en Riviera Sur = Domicilio Gratis

## Logs de Depuración

Cuando la promoción aplica, se registran los siguientes logs:
- Fecha actual y fecha de expiración de la promoción
- Código postal del usuario
- Items de Maison de Poulet en el carrito

Ejemplo:
```
🎉 PROMOCIÓN ACTIVA: Domicilio gratis - Maison de Poulet en Riviera Sur
🎉 Fecha actual: 2025-08-30T14:25:52.180Z
🎉 Promoción válida hasta: 2025-09-01T05:00:00.000Z
🎉 Código postal: J4H 1R3
🎉 Items de Maison de Poulet en carrito: [ { nombre: 'Tacos de cochinilla pibil', cantidad: 2 } ]
```

## Cómo Revertir la Promoción

### Opción 1: Expiración Automática
La promoción expira automáticamente el 1 de septiembre 2025 a las 00:00. No se requiere ninguna acción.

### Opción 2: Desactivación Manual
Para desactivar la promoción antes de tiempo o removerla completamente:

1. Editar `/src/utils/shippingCalculator.js`
2. Localizar el bloque de código entre los comentarios:
   ```javascript
   // ============================================================================
   // PROMOCIÓN TEMPORAL: Domicilio gratis Maison de Poulet en Riviera Sur
   // ============================================================================
   ```
   y
   ```javascript
   // ============================================================================
   // FIN DE PROMOCIÓN TEMPORAL
   // ============================================================================
   ```
3. Eliminar todo el bloque de código de la promoción (líneas 72-107 aproximadamente)
4. Guardar el archivo y reiniciar el servidor

### Opción 3: Cambiar Fecha de Expiración
Para extender o acortar la duración:

1. Editar la línea con `promotionEndDate`:
   ```javascript
   const promotionEndDate = new Date('2025-09-01T00:00:00'); // Cambiar esta fecha
   ```
2. Guardar y reiniciar el servidor

## Monitoreo

Para monitorear el uso de la promoción:
1. Buscar en los logs las líneas que contengan "🎉 PROMOCIÓN ACTIVA"
2. Esto mostrará cada vez que se aplicó el domicilio gratis

## Consideraciones de Seguridad

- La promoción está implementada del lado del servidor
- No puede ser manipulada desde el frontend
- Se validan todas las condiciones antes de aplicar el descuento
- Los logs no exponen información sensible del usuario

## Impacto en el Sistema

- La promoción se integra sin afectar otras reglas de envío existentes
- Mantiene la regla de envío gratis para pedidos >= $200
- No interfiere con las reglas de envío para productos, comidas o pedidos mixtos
- Compatible con el sistema de cupones existente

## Integración con el Frontend

### Respuesta del API

Cuando la promoción está activa, el endpoint `/api/cart` retorna:

```json
{
  "cartItems": [...],
  "cartSummary": {
    "shippingCost": 0,
    "originalShippingCost": 10,
    "shippingMessage": "Promoción aplicada: Domicilio GRATIS - Maison de Poulet en Riviera Sur (válida hasta el 31 de agosto)",
    "promotionApplied": true,
    ...
  }
}
```

### Ejemplo de Implementación en Frontend

```javascript
// En el componente del carrito
if (cartSummary.promotionApplied && cartSummary.shippingMessage) {
  // Mostrar banner de promoción
  showPromotionBanner(cartSummary.shippingMessage);
}

// Mostrar el costo de envío
if (cartSummary.shippingCost === 0 && cartSummary.promotionApplied) {
  // Mostrar envío tachado y GRATIS en verde
  displayShipping = `<del>$${cartSummary.originalShippingCost}</del> <span class="text-success">GRATIS</span>`;
}
```

### Mensajes Sugeridos para el Usuario

**Cuando la promoción aplica:**
- "¡Felicidades! Tu domicilio es GRATIS por tu compra en Maison de Poulet"
- "Promoción especial: Domicilio sin costo - Válida hasta el 31 de agosto"

**Cuando falta poco para aplicar (usuario en Riviera Sur sin productos de Maison de Poulet):**
- "Agrega un producto de Maison de Poulet y obtén domicilio GRATIS (solo Riviera Sur)"

## Verificación de la Promoción

### Comando de Prueba
```bash
# Ejecutar el script de pruebas
node test-promo-maison-poulet.js
```

### Verificación Manual en Producción

1. Crear un carrito con un producto de subcategoría 13
2. Usar una dirección con código postal de Riviera Sur (ej: J4H 1R3)
3. Verificar que el costo de envío sea $0
4. Verificar que aparezca el mensaje de promoción

## Contacto

Para preguntas sobre esta implementación, consultar con el equipo de desarrollo backend.