# Guía de Integración - Sistema de Variaciones de Productos

Esta guía explica cómo integrar el sistema de variaciones de productos en el frontend para permitir que los usuarios seleccionen diferentes opciones (tamaños, combos, add-ons) antes de agregar productos al carrito.

## 📋 Conceptos Principales

### ¿Qué son las Variaciones de Productos?
Las variaciones permiten que un producto tenga diferentes opciones con precios modificados:
- **Tamaños**: Pequeño, Mediano, Grande
- **Combos**: Solo producto vs Con bebida/papas
- **Add-ons**: Extras que se pueden agregar

### Estructura de Datos
```javascript
// Ejemplo de producto con variaciones
{
  id: 162,
  nombre: "Tacos de cochinilla pibil",
  precio: 15.75, // Precio base
  variations: [
    {
      id: 1,
      group_name: "Opciones de Combo",
      group_type: "single", // Solo una opción
      is_required: true,    // El usuario DEBE elegir
      min_selections: 1,
      max_selections: 1,
      product_variations: [
        {
          id: 1,
          name: "Solo Tacos",
          description: "5 tacos de cochinilla pibil",
          price_modifier: 0.00,
          is_default: true
        },
        {
          id: 2, 
          name: "Con Refresco",
          description: "5 tacos de cochinilla pibil + refresco",
          price_modifier: 3.00,
          is_default: false
        }
      ]
    }
  ]
}
```

## 🛠 Endpoints del API

### 1. Obtener Producto con Variaciones
**GET** `/api/v1/products/:id`

```javascript
// Respuesta incluye variaciones automáticamente
{
  id: 162,
  nombre: "Tacos de cochinilla pibil",
  precio: 15.75,
  variations: [...], // Array de grupos de variaciones
  hasVariations: true
}
```

### 2. Listar Productos (Indicador de Variaciones)
**GET** `/api/v1/products`

```javascript
// En el listado, indica si el producto tiene variaciones
{
  products: [
    {
      id: 162,
      nombre: "Tacos de cochinilla pibil",
      precio: 15.75,
      hasVariations: true, // ✅ Indica que tiene variaciones
      // ...otros campos
    }
  ]
}
```

### 3. Agregar al Carrito con Variaciones
**POST** `/api/v1/cart/add`

```javascript
{
  "productId": 162,
  "quantity": 1,
  "variations": [ // ⭐ Nuevo campo
    {
      "variationId": 2, // ID de "Con Refresco"
      "quantity": 1
    }
  ],
  "horaEntregaPreferida": "18:00",
  "metodoEntrega": "puerta",
  "notasEntrega": "Tocar timbre"
}
```

### 4. Ver Carrito con Variaciones
**GET** `/api/v1/cart`

```javascript
// Respuesta incluye las variaciones seleccionadas
{
  cartItems: [
    {
      id: "cart-item-uuid",
      producto: {
        id: 162,
        nombre: "Tacos de cochinilla pibil",
        precio: 15.75
      },
      cantidad: 1,
      selectedVariations: [
        {
          variation: {
            id: 2,
            name: "Con Refresco",
            price_modifier: 3.00,
            group_name: "Opciones de Combo"
          },
          quantity: 1
        }
      ],
      baseSubtotal: 15.75,
      variationModifier: 3.00,
      finalSubtotal: 18.75 // Precio final con variaciones
    }
  ],
  summary: {
    subtotal: 18.75,
    // ... otros totales
  }
}
```

## 🎨 Interfaz de Usuario Recomendada

### 1. Página de Producto Individual

```html
<div class="product-details">
  <h1>Tacos de cochinilla pibil</h1>
  <p class="base-price">Desde $15.75 CAD</p>
  
  <!-- Mostrar variaciones si existen -->
  <div v-if="product.variations.length > 0" class="variations-section">
    <div v-for="group in product.variations" :key="group.id" class="variation-group">
      <h3>{{ group.group_name }}</h3>
      <p v-if="group.is_required" class="required">* Selección requerida</p>
      
      <!-- Para grupos de selección única (radio buttons) -->
      <div v-if="group.group_type === 'single'" class="radio-group">
        <label v-for="variation in group.product_variations" :key="variation.id">
          <input 
            type="radio" 
            :name="`group-${group.id}`"
            :value="variation.id"
            v-model="selectedVariations[group.id]"
            :checked="variation.is_default"
          />
          <span class="variation-name">{{ variation.name }}</span>
          <span class="variation-price">
            {{ variation.price_modifier > 0 ? `+$${variation.price_modifier}` : 'Incluido' }}
          </span>
          <p class="variation-description">{{ variation.description }}</p>
        </label>
      </div>
      
      <!-- Para grupos de selección múltiple (checkboxes) -->
      <div v-if="group.group_type === 'multiple'" class="checkbox-group">
        <!-- Similar estructura con checkboxes -->
      </div>
    </div>
  </div>
  
  <!-- Precio calculado en tiempo real -->
  <div class="calculated-price">
    <h3>Precio Total: ${{ calculateFinalPrice() }} CAD</h3>
  </div>
  
  <button @click="addToCart" :disabled="!areRequiredVariationsSelected()">
    Agregar al Carrito
  </button>
</div>
```

### 2. Listado de Productos (Vista de Tarjetas)

```html
<div class="product-card">
  <img :src="product.imagen_principal" />
  <h3>{{ product.nombre }}</h3>
  
  <!-- Indicador de variaciones -->
  <p class="price">
    <span v-if="product.hasVariations">Desde </span>
    ${{ product.precio }} CAD
    <span v-if="product.hasVariations" class="variations-badge">
      ⚙️ Opciones disponibles
    </span>
  </p>
  
  <!-- Botón contextual -->
  <button v-if="product.hasVariations" @click="goToProductPage(product.id)">
    Ver Opciones
  </button>
  <button v-else @click="quickAddToCart(product.id)">
    Agregar al Carrito
  </button>
</div>
```

### 3. Carrito de Compras

```html
<div class="cart-item">
  <div class="product-info">
    <h4>{{ item.producto.nombre }}</h4>
    
    <!-- Mostrar variaciones seleccionadas -->
    <div v-if="item.selectedVariations.length > 0" class="selected-variations">
      <p class="variations-label">Opciones seleccionadas:</p>
      <ul>
        <li v-for="selected in item.selectedVariations" :key="selected.variation.id">
          {{ selected.variation.group_name }}: {{ selected.variation.name }}
          <span v-if="selected.variation.price_modifier > 0">
            (+${{ selected.variation.price_modifier.toFixed(2) }})
          </span>
        </li>
      </ul>
    </div>
  </div>
  
  <div class="pricing">
    <p class="base-price">Base: ${{ item.producto.precio }}</p>
    <p v-if="item.variationModifier > 0" class="variation-modifier">
      Extras: +${{ item.variationModifier.toFixed(2) }}
    </p>
    <p class="final-price"><strong>Total: ${{ item.finalSubtotal.toFixed(2) }}</strong></p>
  </div>
  
  <div class="quantity-controls">
    <button @click="updateQuantity(item.id, item.cantidad - 1)">-</button>
    <span>{{ item.cantidad }}</span>
    <button @click="updateQuantity(item.id, item.cantidad + 1)">+</button>
  </div>
</div>
```

## 💻 Lógica de Frontend (Vue.js/JavaScript)

### 1. Componente de Producto con Variaciones

```javascript
<template>
  <div class="product-with-variations">
    <!-- UI template aquí -->
  </div>
</template>

<script>
export default {
  name: 'ProductWithVariations',
  data() {
    return {
      product: null,
      selectedVariations: {}, // { groupId: variationId }
      loading: false
    }
  },
  
  async mounted() {
    await this.loadProduct();
    this.initializeDefaultVariations();
  },
  
  methods: {
    async loadProduct() {
      try {
        const response = await fetch(`/api/v1/products/${this.productId}`);
        this.product = await response.json();
      } catch (error) {
        console.error('Error loading product:', error);
      }
    },
    
    initializeDefaultVariations() {
      // Seleccionar opciones por defecto
      this.product.variations?.forEach(group => {
        const defaultVariation = group.product_variations.find(v => v.is_default);
        if (defaultVariation) {
          this.$set(this.selectedVariations, group.id, defaultVariation.id);
        }
      });
    },
    
    calculateFinalPrice() {
      let finalPrice = parseFloat(this.product.precio);
      
      // Sumar modificadores de variaciones seleccionadas
      Object.values(this.selectedVariations).forEach(variationId => {
        const variation = this.findVariationById(variationId);
        if (variation) {
          finalPrice += parseFloat(variation.price_modifier || 0);
        }
      });
      
      return finalPrice.toFixed(2);
    },
    
    findVariationById(variationId) {
      for (const group of this.product.variations || []) {
        const variation = group.product_variations.find(v => v.id === variationId);
        if (variation) return variation;
      }
      return null;
    },
    
    areRequiredVariationsSelected() {
      // Verificar que todos los grupos requeridos tengan selección
      return this.product.variations?.every(group => {
        if (!group.is_required) return true;
        return this.selectedVariations[group.id] !== undefined;
      }) ?? true;
    },
    
    async addToCart() {
      if (!this.areRequiredVariationsSelected()) {
        alert('Por favor selecciona todas las opciones requeridas');
        return;
      }
      
      const variations = Object.values(this.selectedVariations).map(variationId => ({
        variationId: variationId,
        quantity: 1
      }));
      
      try {
        const response = await fetch('/api/v1/cart/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.userToken}`
          },
          body: JSON.stringify({
            productId: this.product.id,
            quantity: this.quantity,
            variations: variations,
            horaEntregaPreferida: this.deliveryTime,
            metodoEntrega: this.deliveryMethod,
            notasEntrega: this.deliveryNotes
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }
        
        const result = await response.json();
        this.$toast.success('Producto agregado al carrito');
        this.updateCartCount();
        
      } catch (error) {
        this.$toast.error(`Error: ${error.message}`);
      }
    }
  }
}
</script>
```

### 2. Servicio de API para Variaciones

```javascript
// services/variationsAPI.js
class VariationsAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }
  
  async getProductWithVariations(productId) {
    const response = await fetch(`${this.baseURL}/products/${productId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load product variations');
    }
    
    return await response.json();
  }
  
  async addToCartWithVariations(productId, quantity, variations, deliveryOptions = {}) {
    const response = await fetch(`${this.baseURL}/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        productId,
        quantity,
        variations,
        ...deliveryOptions
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add to cart');
    }
    
    return await response.json();
  }
  
  async getCartWithVariations() {
    const response = await fetch(`${this.baseURL}/cart`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load cart');
    }
    
    return await response.json();
  }
}

// Uso
const api = new VariationsAPI('/api/v1', userToken);
```

## 🔄 Flujo Completo del Usuario

### 1. Exploración de Productos
1. Usuario ve lista de productos
2. Productos con variaciones muestran "Desde $X" y badge de opciones
3. Usuario hace clic en "Ver Opciones" o en el producto

### 2. Selección de Variaciones  
1. Usuario ve producto con grupos de variaciones
2. Selecciona opciones requeridas (radio buttons/checkboxes)
3. Precio se actualiza en tiempo real
4. Botón "Agregar al Carrito" se habilita cuando todo está seleccionado

### 3. Confirmación en Carrito
1. Carrito muestra producto con variaciones seleccionadas
2. Precio desglosa base + extras + total
3. Usuario puede modificar cantidad o remover item

### 4. Checkout y Pago
1. Stripe recibe line items con nombres descriptivos:
   - "Tacos de cochinilla pibil (Opciones de Combo: Con Refresco)"
2. Orden final incluye todas las variaciones seleccionadas
3. Email de confirmación detalla las opciones elegidas

## ✅ Validaciones y Manejo de Errores

### Frontend Validations
```javascript
const validateVariationSelection = (product, selectedVariations) => {
  const errors = [];
  
  product.variations?.forEach(group => {
    if (group.is_required && !selectedVariations[group.id]) {
      errors.push(`${group.group_name} es requerido`);
    }
    
    const selected = selectedVariations[group.id];
    if (selected) {
      const selectedCount = Array.isArray(selected) ? selected.length : 1;
      
      if (selectedCount < group.min_selections) {
        errors.push(`${group.group_name}: mínimo ${group.min_selections} opciones`);
      }
      
      if (selectedCount > group.max_selections) {
        errors.push(`${group.group_name}: máximo ${group.max_selections} opciones`);
      }
    }
  });
  
  return errors;
};
```

### Backend Error Responses
```javascript
// El backend ya valida y responde con errores específicos:
{
  "error": "Validation error",
  "message": "Invalid variation selection",
  "details": [
    {
      "field": "variations",
      "message": "Variation ID 999 does not exist for product 162"
    }
  ]
}
```

## 🎯 Mejores Prácticas

### 1. UX/UI
- **Indicadores claros**: Badge o texto "Opciones disponibles"
- **Precios dinámicos**: Actualizar precio mientras el usuario selecciona
- **Validación en tiempo real**: Deshabilitar botones hasta completar selección
- **Descripciones útiles**: Mostrar qué incluye cada variación

### 2. Performance
- **Caché productos**: Guardar productos con variaciones en localStorage
- **Lazy loading**: Cargar variaciones solo cuando sea necesario
- **Debounce**: Para cálculos de precio en tiempo real

### 3. Accesibilidad
- **Labels apropiados**: Para screen readers
- **Keyboard navigation**: Permitir navegación con teclado
- **Focus management**: Manejar focus en grupos de opciones

### 4. Estados de Loading
```javascript
// Estados recomendados
const loadingStates = {
  loadingProduct: false,
  addingToCart: false,
  updatingCart: false
};

// Mostrar spinners/skeletons apropiados
```

## 🛍 Productos de Ejemplo Configurados

Los siguientes productos de **La Maison de Poulet** ya tienen variaciones configuradas:

1. **Tacos de cochinilla pibil (ID: 162)**
   - Solo Tacos: $15.75
   - Con Refresco: $18.75

2. **Pozole (ID: 190)**
   - Mediano: $15.75  
   - Grande: $25.75

3. **Sandwich de puerco (ID: 166)**
   - Regular: $15.75
   - Con Papas y Gaseosa: $18.75

4. **Arroz con arvejas (ID: 163)**
   - Pequeña: $6.75
   - Grande: $9.75

5. **Consomé de carne de res (ID: 191)**
   - Mediano: $21.75
   - Grande: $39.75

6. **Costilla de cerdo (ID: 192)**
   - Individual: $18.74
   - Combo: $26.74 *(por defecto)*
   - Familiar: $46.74

## 🧪 Testing

### Unit Tests Sugeridos
```javascript
// Ejemplo de tests para componentes de variaciones
describe('ProductVariations Component', () => {
  test('should initialize default variations', () => {
    // Test que las opciones por defecto se seleccionen automáticamente
  });
  
  test('should calculate correct final price', () => {
    // Test que el precio se calcule correctamente con modificadores
  });
  
  test('should validate required selections', () => {
    // Test que las validaciones de grupos requeridos funcionen
  });
  
  test('should format cart data correctly', () => {
    // Test que los datos se envíen al carrito en formato correcto
  });
});
```

### Integration Tests
```javascript
// Tests end-to-end para flujo completo
describe('Variations E2E Flow', () => {
  test('should complete full purchase with variations', async () => {
    // Simular flujo completo: selección → carrito → checkout → orden
  });
});
```

## 📞 Soporte y Debugging

### Logs Útiles
El backend logea automáticamente:
- Validaciones de variaciones fallidas
- Cálculos de precios con modificadores  
- Creación de órdenes con variaciones

### Common Issues
1. **Variaciones no aparecen**: Verificar que `active=true` en la base de datos
2. **Precios incorrectos**: Revisar que `price_modifier` sea numérico
3. **Validación falla**: Verificar que `is_required` coincida con la selección del usuario

---

## 🚀 Implementación Paso a Paso

1. **Implementar UI de selección** en páginas de productos
2. **Integrar API calls** para productos con variaciones  
3. **Actualizar componente de carrito** para mostrar variaciones
4. **Testing** del flujo completo
5. **Despliegue** y monitoreo

Con esta guía completa, el frontend puede implementar un sistema robusto de variaciones que mejorará significativamente la experiencia del usuario y las capacidades del e-commerce.