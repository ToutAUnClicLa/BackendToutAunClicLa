# 📦 Product Variations System Documentation

Complete guide for implementing product variations in the frontend for ToutAunClicLa.

## Table of Contents
- [Overview](#overview)
- [Database Structure](#database-structure)
- [API Endpoints](#api-endpoints)
- [Frontend Implementation Guide](#frontend-implementation-guide)
- [Use Cases & Examples](#use-cases--examples)
- [Best Practices](#best-practices)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

---

## Overview

The product variations system allows products to have customizable options that modify the base price. Perfect for:
- **Restaurant items**: Pizza sizes, toppings, cooking preferences
- **Products**: Colors, sizes, materials
- **Services**: Duration, add-ons, packages

### Key Features
- ✅ Single or multiple selection groups
- ✅ Required and optional variations
- ✅ Price modifiers (positive or negative)
- ✅ Stock tracking per variation
- ✅ Min/max selection limits
- ✅ Default selections
- ✅ Display ordering

---

## Database Structure

### Tables Relationship
```
productos (products)
    ↓
variation_groups (e.g., "Size", "Toppings")
    ↓
product_variations (e.g., "Large", "Extra Cheese")
    ↓
cart_item_variations (selected variations in cart)
```

### variation_groups Table
```sql
{
  id: integer,
  producto_id: integer,          // Product ID
  group_name: string,            // "Size", "Color", "Toppings"
  group_type: string,            // "single_select" or "multi_select"
  is_required: boolean,          // Must user select an option?
  min_selections: integer,       // Minimum selections (for multi_select)
  max_selections: integer,       // Maximum selections (for multi_select)
  display_order: integer,        // Display sequence
  active: boolean               // Is group active?
}
```

### product_variations Table
```sql
{
  id: integer,
  variation_group_id: integer,   // Parent group ID
  name: string,                  // "Large", "Red", "Extra Cheese"
  description: string,           // Optional description
  price_modifier: decimal,       // Price change (+2.50, -1.00, 0)
  stock: integer,                // Optional stock tracking
  is_default: boolean,           // Pre-selected option
  display_order: integer,        // Display sequence
  sku: string,                   // Optional SKU
  active: boolean               // Is variation active?
}
```

### cart_item_variations Table
```sql
{
  id: integer,
  cart_item_id: integer,        // Cart item this belongs to
  variation_id: integer,        // Selected variation
  quantity: integer,             // Quantity of this variation
  price_at_time: decimal        // Price when added (historical)
}
```

---

## API Endpoints

### 1. Get Product with Variations

**GET** `/api/v1/products/:id`

Returns product details including all variation groups and options.

#### Response Structure
```json
{
  "id": 100,
  "nombre": "Pizza Margherita",
  "descripcion": "Traditional Italian pizza",
  "precio": 15.99,
  "stock": 50,
  "categoria_id": 2,
  "variations": [
    {
      "id": 1,
      "group_name": "Size",
      "group_type": "single_select",
      "is_required": true,
      "min_selections": 1,
      "max_selections": 1,
      "display_order": 1,
      "product_variations": [
        {
          "id": 10,
          "name": "Small (10\")",
          "description": "Serves 1-2 people",
          "price_modifier": -3.00,
          "stock": null,
          "is_default": false,
          "display_order": 1
        },
        {
          "id": 11,
          "name": "Medium (12\")",
          "description": "Serves 2-3 people",
          "price_modifier": 0,
          "stock": null,
          "is_default": true,
          "display_order": 2
        },
        {
          "id": 12,
          "name": "Large (14\")",
          "description": "Serves 3-4 people",
          "price_modifier": 4.00,
          "stock": 10,
          "is_default": false,
          "display_order": 3
        }
      ]
    },
    {
      "id": 2,
      "group_name": "Extra Toppings",
      "group_type": "multi_select",
      "is_required": false,
      "min_selections": 0,
      "max_selections": 5,
      "display_order": 2,
      "product_variations": [
        {
          "id": 20,
          "name": "Extra Cheese",
          "price_modifier": 2.50,
          "stock": null,
          "is_default": false,
          "display_order": 1
        },
        {
          "id": 21,
          "name": "Pepperoni",
          "price_modifier": 3.00,
          "stock": 15,
          "is_default": false,
          "display_order": 2
        },
        {
          "id": 22,
          "name": "Mushrooms",
          "price_modifier": 2.00,
          "stock": null,
          "is_default": false,
          "display_order": 3
        }
      ]
    }
  ]
}
```

### 2. Add to Cart with Variations

**POST** `/api/v1/cart/items`

#### Request Body
```json
{
  "productId": 100,
  "quantity": 2,
  "variations": [
    {
      "variationId": 12,    // Large size
      "quantity": 1
    },
    {
      "variationId": 20,    // Extra cheese
      "quantity": 1
    },
    {
      "variationId": 21,    // Pepperoni
      "quantity": 2         // Double pepperoni
    }
  ],
  "horaEntregaPreferida": "19:00",
  "metodoEntrega": "puerta",
  "tipoEntrega": "estandar"
}
```

### 3. Get Cart with Variations

**GET** `/api/v1/cart`

Returns cart items with their selected variations.

#### Response Structure
```json
{
  "cartItems": [
    {
      "id": 456,
      "producto_id": 100,
      "cantidad": 2,
      "productos": {
        "id": 100,
        "nombre": "Pizza Margherita",
        "precio": 15.99
      },
      "variations": [
        {
          "cart_item_id": 456,
          "variation_id": 12,
          "quantity": 1,
          "price_at_time": 4.00,
          "product_variations": {
            "id": 12,
            "name": "Large (14\")",
            "description": "Serves 3-4 people",
            "price_modifier": 4.00
          }
        },
        {
          "cart_item_id": 456,
          "variation_id": 20,
          "quantity": 1,
          "price_at_time": 2.50,
          "product_variations": {
            "id": 20,
            "name": "Extra Cheese",
            "price_modifier": 2.50
          }
        },
        {
          "cart_item_id": 456,
          "variation_id": 21,
          "quantity": 2,
          "price_at_time": 3.00,
          "product_variations": {
            "id": 21,
            "name": "Pepperoni",
            "price_modifier": 3.00
          }
        }
      ]
    }
  ],
  "summary": {
    "subtotal": 51.98,  // (15.99 base + 4.00 size + 2.50 cheese + 6.00 pepperoni) × 2
    "total": 59.76
  }
}
```

---

## Frontend Implementation Guide

### 1. Product Detail Component Structure

```vue
<template>
  <div class="product-detail">
    <!-- Product Basic Info -->
    <div class="product-header">
      <h1>{{ product.nombre }}</h1>
      <p>{{ product.descripcion }}</p>
      <div class="base-price">
        Desde ${{ calculateMinPrice() }}
      </div>
    </div>

    <!-- Variations Section -->
    <div class="variations-container" v-if="product.variations">
      <div v-for="group in sortedVariationGroups" 
           :key="group.id" 
           class="variation-group"
           :class="{ 'required': group.is_required }">
        
        <h3 class="group-title">
          {{ group.group_name }}
          <span v-if="group.is_required" class="required-badge">Requerido</span>
          <span v-if="group.max_selections" class="selection-info">
            (Máx. {{ group.max_selections }})
          </span>
        </h3>

        <!-- Single Select Group (Radio Buttons) -->
        <div v-if="group.group_type === 'single_select'" 
             class="single-select-group">
          <label v-for="variation in sortedVariations(group.product_variations)" 
                 :key="variation.id"
                 class="variation-option"
                 :class="{ 'out-of-stock': isOutOfStock(variation) }">
            <input type="radio" 
                   :name="`group_${group.id}`"
                   :value="variation.id"
                   v-model="selectedVariations[group.id]"
                   :disabled="isOutOfStock(variation)"
                   @change="onVariationChange">
            <div class="option-content">
              <span class="option-name">{{ variation.name }}</span>
              <span v-if="variation.description" class="option-desc">
                {{ variation.description }}
              </span>
              <span class="option-price">
                <template v-if="variation.price_modifier > 0">
                  +${{ variation.price_modifier.toFixed(2) }}
                </template>
                <template v-else-if="variation.price_modifier < 0">
                  -${{ Math.abs(variation.price_modifier).toFixed(2) }}
                </template>
              </span>
              <span v-if="variation.stock !== null && variation.stock <= 5" 
                    class="stock-warning">
                Solo quedan {{ variation.stock }}
              </span>
            </div>
          </label>
        </div>

        <!-- Multi Select Group (Checkboxes with Quantities) -->
        <div v-if="group.group_type === 'multi_select'" 
             class="multi-select-group">
          <div v-for="variation in sortedVariations(group.product_variations)" 
               :key="variation.id"
               class="variation-option multi"
               :class="{ 'out-of-stock': isOutOfStock(variation) }">
            <label class="option-checkbox">
              <input type="checkbox" 
                     :value="variation.id"
                     v-model="selectedMultiVariations[group.id]"
                     :disabled="isOutOfStock(variation) || reachedMaxSelections(group)"
                     @change="onVariationChange">
              <div class="option-content">
                <span class="option-name">{{ variation.name }}</span>
                <span class="option-price">
                  +${{ variation.price_modifier.toFixed(2) }}
                </span>
              </div>
            </label>
            <div v-if="isVariationSelected(group.id, variation.id)" 
                 class="quantity-selector">
              <button @click="decrementQuantity(variation.id)" 
                      :disabled="getVariationQuantity(variation.id) <= 1">
                -
              </button>
              <input type="number" 
                     :value="getVariationQuantity(variation.id)"
                     @input="setVariationQuantity(variation.id, $event.target.value)"
                     min="1"
                     :max="variation.stock || 99">
              <button @click="incrementQuantity(variation.id)"
                      :disabled="variation.stock && getVariationQuantity(variation.id) >= variation.stock">
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Price Summary -->
    <div class="price-summary">
      <div class="price-breakdown">
        <div class="price-line">
          <span>Precio base:</span>
          <span>${{ product.precio }}</span>
        </div>
        <div v-for="(price, name) in variationPriceBreakdown" 
             :key="name" 
             class="price-line variation">
          <span>{{ name }}:</span>
          <span>+${{ price.toFixed(2) }}</span>
        </div>
        <div class="price-line total">
          <span>Precio unitario:</span>
          <span>${{ calculateTotalPrice().toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Quantity and Add to Cart -->
    <div class="cart-controls">
      <div class="quantity-control">
        <label>Cantidad:</label>
        <button @click="productQuantity--" :disabled="productQuantity <= 1">-</button>
        <input v-model.number="productQuantity" type="number" min="1">
        <button @click="productQuantity++">+</button>
      </div>
      
      <button @click="addToCart" 
              class="add-to-cart-btn"
              :disabled="!canAddToCart">
        <span v-if="!canAddToCart">{{ validationMessage }}</span>
        <span v-else>
          Agregar al Carrito - ${{ (calculateTotalPrice() * productQuantity).toFixed(2) }}
        </span>
      </button>
    </div>

    <!-- Validation Messages -->
    <div v-if="validationErrors.length > 0" class="validation-errors">
      <p v-for="error in validationErrors" :key="error" class="error-msg">
        ⚠️ {{ error }}
      </p>
    </div>
  </div>
</template>
```

### 2. Vue.js/React Implementation Logic

#### Vue.js Example
```javascript
export default {
  data() {
    return {
      product: {},
      selectedVariations: {},      // {groupId: variationId} for single select
      selectedMultiVariations: {},  // {groupId: [variationIds]} for multi select
      variationQuantities: {},      // {variationId: quantity}
      productQuantity: 1,
      validationErrors: [],
      loading: false
    };
  },

  computed: {
    sortedVariationGroups() {
      if (!this.product.variations) return [];
      return [...this.product.variations].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
    },

    variationPriceBreakdown() {
      const breakdown = {};
      
      if (!this.product.variations) return breakdown;
      
      this.product.variations.forEach(group => {
        if (group.group_type === 'single_select') {
          const selectedId = this.selectedVariations[group.id];
          if (selectedId) {
            const variation = group.product_variations.find(v => v.id === selectedId);
            if (variation && variation.price_modifier !== 0) {
              breakdown[variation.name] = variation.price_modifier;
            }
          }
        } else if (group.group_type === 'multi_select') {
          const selectedIds = this.selectedMultiVariations[group.id] || [];
          selectedIds.forEach(varId => {
            const variation = group.product_variations.find(v => v.id === varId);
            if (variation) {
              const qty = this.variationQuantities[varId] || 1;
              const key = qty > 1 ? `${variation.name} x${qty}` : variation.name;
              breakdown[key] = variation.price_modifier * qty;
            }
          });
        }
      });
      
      return breakdown;
    },

    canAddToCart() {
      return this.validationErrors.length === 0 && !this.loading;
    },

    validationMessage() {
      if (this.validationErrors.length > 0) {
        return this.validationErrors[0];
      }
      return 'Agregar al Carrito';
    }
  },

  methods: {
    async loadProduct(productId) {
      this.loading = true;
      try {
        const response = await fetch(`/api/v1/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to load product');
        
        this.product = await response.json();
        this.initializeVariations();
      } catch (error) {
        console.error('Error loading product:', error);
        this.$toast.error('Error cargando el producto');
      } finally {
        this.loading = false;
      }
    },

    initializeVariations() {
      if (!this.product.variations) return;
      
      this.product.variations.forEach(group => {
        if (group.group_type === 'single_select') {
          // Set default selection
          const defaultVar = group.product_variations.find(v => v.is_default) 
                          || (group.is_required ? group.product_variations[0] : null);
          if (defaultVar) {
            this.$set(this.selectedVariations, group.id, defaultVar.id);
          }
        } else if (group.group_type === 'multi_select') {
          this.$set(this.selectedMultiVariations, group.id, []);
        }
      });
      
      this.validateSelections();
    },

    sortedVariations(variations) {
      return [...variations].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
    },

    isOutOfStock(variation) {
      return variation.stock !== null && variation.stock === 0;
    },

    reachedMaxSelections(group) {
      if (!group.max_selections) return false;
      const selected = this.selectedMultiVariations[group.id] || [];
      return selected.length >= group.max_selections;
    },

    isVariationSelected(groupId, variationId) {
      const selected = this.selectedMultiVariations[groupId] || [];
      return selected.includes(variationId);
    },

    getVariationQuantity(variationId) {
      return this.variationQuantities[variationId] || 1;
    },

    setVariationQuantity(variationId, value) {
      const qty = Math.max(1, parseInt(value) || 1);
      this.$set(this.variationQuantities, variationId, qty);
      this.onVariationChange();
    },

    incrementQuantity(variationId) {
      const current = this.getVariationQuantity(variationId);
      this.setVariationQuantity(variationId, current + 1);
    },

    decrementQuantity(variationId) {
      const current = this.getVariationQuantity(variationId);
      if (current > 1) {
        this.setVariationQuantity(variationId, current - 1);
      }
    },

    calculateMinPrice() {
      let minPrice = parseFloat(this.product.precio || 0);
      
      // Add required groups minimum price
      if (this.product.variations) {
        this.product.variations.forEach(group => {
          if (group.is_required && group.product_variations.length > 0) {
            const minModifier = Math.min(...group.product_variations.map(v => 
              v.price_modifier || 0
            ));
            if (minModifier > 0) {
              minPrice += minModifier;
            }
          }
        });
      }
      
      return minPrice.toFixed(2);
    },

    calculateTotalPrice() {
      let total = parseFloat(this.product.precio || 0);
      
      if (!this.product.variations) return total;
      
      // Add single select variations
      this.product.variations.forEach(group => {
        if (group.group_type === 'single_select') {
          const selectedId = this.selectedVariations[group.id];
          if (selectedId) {
            const variation = group.product_variations.find(v => v.id === selectedId);
            if (variation) {
              total += parseFloat(variation.price_modifier || 0);
            }
          }
        } else if (group.group_type === 'multi_select') {
          const selectedIds = this.selectedMultiVariations[group.id] || [];
          selectedIds.forEach(varId => {
            const variation = group.product_variations.find(v => v.id === varId);
            if (variation) {
              const qty = this.variationQuantities[varId] || 1;
              total += parseFloat(variation.price_modifier || 0) * qty;
            }
          });
        }
      });
      
      return total;
    },

    onVariationChange() {
      this.validateSelections();
    },

    validateSelections() {
      const errors = [];
      
      if (!this.product.variations) {
        this.validationErrors = errors;
        return;
      }
      
      this.product.variations.forEach(group => {
        // Check required groups
        if (group.is_required) {
          if (group.group_type === 'single_select') {
            if (!this.selectedVariations[group.id]) {
              errors.push(`Seleccione una opción para ${group.group_name}`);
            }
          } else if (group.group_type === 'multi_select') {
            const selected = this.selectedMultiVariations[group.id] || [];
            if (selected.length === 0) {
              errors.push(`Seleccione al menos una opción para ${group.group_name}`);
            }
            if (group.min_selections && selected.length < group.min_selections) {
              errors.push(`Seleccione al menos ${group.min_selections} opciones para ${group.group_name}`);
            }
          }
        }
        
        // Check max selections for multi-select
        if (group.group_type === 'multi_select' && group.max_selections) {
          const selected = this.selectedMultiVariations[group.id] || [];
          if (selected.length > group.max_selections) {
            errors.push(`Máximo ${group.max_selections} opciones para ${group.group_name}`);
          }
        }
        
        // Check stock availability
        if (group.group_type === 'single_select') {
          const selectedId = this.selectedVariations[group.id];
          if (selectedId) {
            const variation = group.product_variations.find(v => v.id === selectedId);
            if (variation && variation.stock !== null && variation.stock === 0) {
              errors.push(`${variation.name} está agotado`);
            }
          }
        } else if (group.group_type === 'multi_select') {
          const selectedIds = this.selectedMultiVariations[group.id] || [];
          selectedIds.forEach(varId => {
            const variation = group.product_variations.find(v => v.id === varId);
            if (variation && variation.stock !== null) {
              const qty = this.variationQuantities[varId] || 1;
              if (variation.stock < qty) {
                errors.push(`Solo quedan ${variation.stock} unidades de ${variation.name}`);
              }
            }
          });
        }
      });
      
      this.validationErrors = errors;
    },

    prepareVariationsForCart() {
      const variations = [];
      
      if (!this.product.variations) return variations;
      
      this.product.variations.forEach(group => {
        if (group.group_type === 'single_select') {
          const selectedId = this.selectedVariations[group.id];
          if (selectedId) {
            variations.push({
              variationId: selectedId,
              quantity: 1
            });
          }
        } else if (group.group_type === 'multi_select') {
          const selectedIds = this.selectedMultiVariations[group.id] || [];
          selectedIds.forEach(varId => {
            variations.push({
              variationId: varId,
              quantity: this.variationQuantities[varId] || 1
            });
          });
        }
      });
      
      return variations;
    },

    async addToCart() {
      // Validate before adding
      this.validateSelections();
      if (this.validationErrors.length > 0) {
        this.$toast.error(this.validationErrors[0]);
        return;
      }
      
      this.loading = true;
      
      try {
        const cartData = {
          productId: this.product.id,
          quantity: this.productQuantity,
          variations: this.prepareVariationsForCart(),
          horaEntregaPreferida: '18:00',
          metodoEntrega: 'puerta',
          tipoEntrega: 'estandar'
        };
        
        const response = await fetch('/api/v1/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          },
          body: JSON.stringify(cartData)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Error adding to cart');
        }
        
        const result = await response.json();
        
        // Success feedback
        this.$toast.success('Producto agregado al carrito');
        
        // Update cart count in store/header
        this.$store.dispatch('cart/updateCount');
        
        // Optional: Reset selections or redirect
        // this.$router.push('/cart');
        
      } catch (error) {
        console.error('Error adding to cart:', error);
        this.$toast.error(error.message || 'Error al agregar al carrito');
      } finally {
        this.loading = false;
      }
    }
  },

  mounted() {
    const productId = this.$route.params.id;
    this.loadProduct(productId);
  }
};
```

### 3. Cart Display Component

```vue
<template>
  <div class="shopping-cart">
    <h2>Carrito de Compras</h2>
    
    <div v-if="cartItems.length === 0" class="empty-cart">
      <p>Tu carrito está vacío</p>
      <router-link to="/products" class="continue-shopping">
        Continuar Comprando
      </router-link>
    </div>
    
    <div v-else class="cart-content">
      <!-- Cart Items -->
      <div class="cart-items">
        <div v-for="item in cartItems" :key="item.id" class="cart-item">
          <div class="item-image">
            <img :src="item.productos.imagen_principal || '/placeholder.jpg'" 
                 :alt="item.productos.nombre">
          </div>
          
          <div class="item-details">
            <h3>{{ item.productos.nombre }}</h3>
            
            <!-- Base Price -->
            <div class="price-info">
              <span class="base-price">Precio base: ${{ item.productos.precio }}</span>
            </div>
            
            <!-- Variations Display -->
            <div v-if="item.variations && item.variations.length > 0" 
                 class="item-variations">
              <h4>Personalizaciones:</h4>
              <ul class="variations-list">
                <li v-for="variation in item.variations" 
                    :key="variation.variation_id"
                    class="variation-detail">
                  <span class="var-name">{{ variation.product_variations.name }}</span>
                  <span v-if="variation.quantity > 1" class="var-qty">
                    × {{ variation.quantity }}
                  </span>
                  <span class="var-price">
                    +${{ (variation.price_at_time * variation.quantity).toFixed(2) }}
                  </span>
                </li>
              </ul>
            </div>
            
            <!-- Delivery Info -->
            <div class="delivery-info">
              <p><strong>Entrega:</strong> {{ formatDeliveryTime(item) }}</p>
              <p v-if="item.notas_entrega">
                <strong>Notas:</strong> {{ item.notas_entrega }}
              </p>
            </div>
            
            <!-- Item Total -->
            <div class="item-price-summary">
              <p class="unit-price">
                Precio unitario: ${{ calculateItemUnitPrice(item).toFixed(2) }}
              </p>
              <p class="item-total">
                Subtotal (×{{ item.cantidad }}): 
                <strong>${{ calculateItemTotal(item).toFixed(2) }}</strong>
              </p>
            </div>
          </div>
          
          <!-- Quantity Controls -->
          <div class="item-actions">
            <div class="quantity-control">
              <button @click="updateQuantity(item.id, item.cantidad - 1)" 
                      :disabled="item.cantidad <= 1">
                -
              </button>
              <span>{{ item.cantidad }}</span>
              <button @click="updateQuantity(item.id, item.cantidad + 1)">
                +
              </button>
            </div>
            <button @click="removeItem(item.id)" class="remove-btn">
              Eliminar
            </button>
          </div>
        </div>
      </div>
      
      <!-- Cart Summary -->
      <div class="cart-summary">
        <h3>Resumen del Pedido</h3>
        
        <div class="summary-line">
          <span>Subtotal:</span>
          <span>${{ cartSummary.subtotal.toFixed(2) }}</span>
        </div>
        
        <div v-if="cartSummary.totalTPS > 0" class="summary-line">
          <span>TPS (5%):</span>
          <span>${{ cartSummary.totalTPS.toFixed(2) }}</span>
        </div>
        
        <div v-if="cartSummary.totalTVQ > 0" class="summary-line">
          <span>TVQ (9.975%):</span>
          <span>${{ cartSummary.totalTVQ.toFixed(2) }}</span>
        </div>
        
        <div v-if="cartSummary.totalConsigne > 0" class="summary-line">
          <span>Consigne:</span>
          <span>${{ cartSummary.totalConsigne.toFixed(2) }}</span>
        </div>
        
        <div class="summary-line shipping">
          <span>Envío:</span>
          <span v-if="cartSummary.shippingCost === 0" class="free-shipping">
            GRATIS
          </span>
          <span v-else>${{ cartSummary.shippingCost.toFixed(2) }}</span>
        </div>
        
        <div v-if="appliedCoupon" class="summary-line discount">
          <span>Descuento ({{ appliedCoupon.code }}):</span>
          <span>-${{ cartSummary.discountAmount.toFixed(2) }}</span>
        </div>
        
        <div class="summary-line total">
          <span>Total:</span>
          <span>${{ cartSummary.total.toFixed(2) }}</span>
        </div>
        
        <!-- Coupon Section -->
        <div class="coupon-section">
          <input v-model="couponCode" 
                 placeholder="Código de cupón"
                 @keyup.enter="applyCoupon">
          <button @click="applyCoupon" :disabled="!couponCode">
            Aplicar
          </button>
        </div>
        
        <!-- Checkout Button -->
        <button @click="proceedToCheckout" class="checkout-btn">
          Proceder al Pago
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      cartItems: [],
      cartSummary: {
        subtotal: 0,
        totalTPS: 0,
        totalTVQ: 0,
        totalConsigne: 0,
        shippingCost: 0,
        discountAmount: 0,
        total: 0
      },
      appliedCoupon: null,
      couponCode: '',
      loading: false
    };
  },
  
  methods: {
    async loadCart() {
      try {
        const response = await fetch('/api/v1/cart', {
          headers: {
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          }
        });
        
        const data = await response.json();
        this.cartItems = data.cartItems;
        this.cartSummary = data.summary;
        this.appliedCoupon = data.appliedCoupon;
      } catch (error) {
        console.error('Error loading cart:', error);
      }
    },
    
    calculateItemUnitPrice(item) {
      let price = parseFloat(item.productos.precio);
      
      if (item.variations) {
        item.variations.forEach(variation => {
          price += parseFloat(variation.price_at_time) * variation.quantity;
        });
      }
      
      return price;
    },
    
    calculateItemTotal(item) {
      return this.calculateItemUnitPrice(item) * item.cantidad;
    },
    
    formatDeliveryTime(item) {
      const time = item.hora_entrega_preferida || '18:00';
      const method = {
        'puerta': 'En puerta',
        'manos': 'En mano',
        'recepcion': 'En recepción'
      }[item.metodo_entrega] || 'En puerta';
      
      const type = item.tipo_entrega === 'siguiente_dia' ? 
        'Mañana' : 'Hoy';
      
      return `${type} a las ${time} - ${method}`;
    },
    
    async updateQuantity(itemId, newQuantity) {
      if (newQuantity < 1) return;
      
      try {
        await fetch(`/api/v1/cart/items/${itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          },
          body: JSON.stringify({ quantity: newQuantity })
        });
        
        await this.loadCart();
      } catch (error) {
        console.error('Error updating quantity:', error);
      }
    },
    
    async removeItem(itemId) {
      if (!confirm('¿Eliminar este producto del carrito?')) return;
      
      try {
        await fetch(`/api/v1/cart/items/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          }
        });
        
        await this.loadCart();
        this.$toast.success('Producto eliminado');
      } catch (error) {
        console.error('Error removing item:', error);
      }
    },
    
    async applyCoupon() {
      if (!this.couponCode) return;
      
      try {
        const response = await fetch('/api/v1/cart/apply-coupon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          },
          body: JSON.stringify({ couponCode: this.couponCode })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }
        
        await this.loadCart();
        this.$toast.success('Cupón aplicado correctamente');
        this.couponCode = '';
      } catch (error) {
        this.$toast.error(error.message || 'Cupón inválido');
      }
    },
    
    proceedToCheckout() {
      this.$router.push('/checkout');
    }
  },
  
  mounted() {
    this.loadCart();
  }
};
</script>
```

---

## Use Cases & Examples

### 1. Restaurant Menu Item
```javascript
// Pizza with customizations
{
  "product": {
    "id": 100,
    "nombre": "Pizza Custom",
    "precio": 12.99
  },
  "variations": [
    {
      "group_name": "Tamaño",
      "group_type": "single_select",
      "is_required": true,
      "product_variations": [
        {"name": "Personal 8\"", "price_modifier": -2.00},
        {"name": "Mediana 12\"", "price_modifier": 0, "is_default": true},
        {"name": "Familiar 16\"", "price_modifier": 5.00}
      ]
    },
    {
      "group_name": "Masa",
      "group_type": "single_select",
      "is_required": true,
      "product_variations": [
        {"name": "Tradicional", "price_modifier": 0, "is_default": true},
        {"name": "Delgada", "price_modifier": 0},
        {"name": "Borde Relleno", "price_modifier": 3.00}
      ]
    },
    {
      "group_name": "Ingredientes Extra",
      "group_type": "multi_select",
      "max_selections": 5,
      "product_variations": [
        {"name": "Queso Extra", "price_modifier": 2.00},
        {"name": "Pepperoni", "price_modifier": 2.50},
        {"name": "Champiñones", "price_modifier": 1.50},
        {"name": "Aceitunas", "price_modifier": 1.50}
      ]
    }
  ]
}
```

### 2. Clothing Product
```javascript
// T-Shirt with size and color
{
  "product": {
    "id": 200,
    "nombre": "Camiseta Premium",
    "precio": 29.99
  },
  "variations": [
    {
      "group_name": "Talla",
      "group_type": "single_select",
      "is_required": true,
      "product_variations": [
        {"name": "S", "price_modifier": 0, "stock": 5},
        {"name": "M", "price_modifier": 0, "stock": 10, "is_default": true},
        {"name": "L", "price_modifier": 0, "stock": 8},
        {"name": "XL", "price_modifier": 2.00, "stock": 3},
        {"name": "XXL", "price_modifier": 4.00, "stock": 2}
      ]
    },
    {
      "group_name": "Color",
      "group_type": "single_select",
      "is_required": true,
      "product_variations": [
        {"name": "Negro", "price_modifier": 0, "is_default": true},
        {"name": "Blanco", "price_modifier": 0},
        {"name": "Azul", "price_modifier": 0},
        {"name": "Edición Especial Oro", "price_modifier": 10.00, "stock": 1}
      ]
    }
  ]
}
```

### 3. Service Product
```javascript
// Car Wash Service
{
  "product": {
    "id": 300,
    "nombre": "Lavado de Auto",
    "precio": 15.00
  },
  "variations": [
    {
      "group_name": "Tipo de Vehículo",
      "group_type": "single_select",
      "is_required": true,
      "product_variations": [
        {"name": "Sedán", "price_modifier": 0, "is_default": true},
        {"name": "SUV", "price_modifier": 5.00},
        {"name": "Camioneta", "price_modifier": 10.00},
        {"name": "Motocicleta", "price_modifier": -5.00}
      ]
    },
    {
      "group_name": "Servicios Adicionales",
      "group_type": "multi_select",
      "product_variations": [
        {"name": "Encerado", "price_modifier": 20.00},
        {"name": "Limpieza Interior Profunda", "price_modifier": 25.00},
        {"name": "Aromatizante", "price_modifier": 5.00},
        {"name": "Limpieza Motor", "price_modifier": 15.00}
      ]
    }
  ]
}
```

---

## Best Practices

### 1. Performance Optimization
```javascript
// Cache variation calculations
computed: {
  // Memoize expensive calculations
  variationPriceMap() {
    const map = new Map();
    this.product.variations?.forEach(group => {
      group.product_variations.forEach(variation => {
        map.set(variation.id, variation.price_modifier);
      });
    });
    return map;
  },
  
  totalVariationPrice() {
    // Use cached map instead of searching arrays
    let total = 0;
    this.selectedVariationIds.forEach(id => {
      total += this.variationPriceMap.get(id) || 0;
    });
    return total;
  }
}
```

### 2. User Experience
```javascript
// Provide instant feedback
methods: {
  onVariationSelect(variation) {
    // Show price change animation
    this.animatePriceChange(variation.price_modifier);
    
    // Update URL for shareable links
    this.updateURLParams({
      variations: this.selectedVariationIds
    });
    
    // Save selection to localStorage for recovery
    this.saveSelectionToLocal();
  }
}
```

### 3. Validation & Error Handling
```javascript
// Comprehensive validation
validateVariations() {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  this.requiredGroups.forEach(group => {
    if (!this.hasSelection(group)) {
      errors.push({
        field: group.id,
        message: `${group.group_name} es requerido`
      });
    }
  });
  
  // Check stock with buffer
  this.selectedVariations.forEach(variation => {
    if (variation.stock !== null) {
      if (variation.stock === 0) {
        errors.push({
          field: variation.id,
          message: `${variation.name} agotado`
        });
      } else if (variation.stock <= 5) {
        warnings.push({
          field: variation.id,
          message: `Quedan solo ${variation.stock} unidades`
        });
      }
    }
  });
  
  return { errors, warnings };
}
```

### 4. Accessibility
```html
<!-- Proper ARIA labels and keyboard navigation -->
<fieldset class="variation-group" 
          :aria-required="group.is_required"
          :aria-invalid="hasError(group.id)">
  <legend>
    {{ group.group_name }}
    <span v-if="group.is_required" aria-label="requerido">*</span>
  </legend>
  
  <div role="radiogroup" v-if="group.group_type === 'single_select'">
    <label v-for="variation in group.product_variations"
           :key="variation.id"
           :aria-describedby="`desc-${variation.id}`">
      <input type="radio"
             :name="`group-${group.id}`"
             :value="variation.id"
             :aria-label="variation.name"
             :disabled="isDisabled(variation)"
             @change="announceChange">
      <span>{{ variation.name }}</span>
      <span :id="`desc-${variation.id}`" class="sr-only">
        {{ getPriceDescription(variation) }}
      </span>
    </label>
  </div>
</fieldset>
```

### 5. State Management (Vuex/Pinia)
```javascript
// Store module for variations
const variationsModule = {
  state: {
    selectedVariations: {},
    variationQuantities: {},
    validationErrors: []
  },
  
  mutations: {
    SET_VARIATION(state, { groupId, variationId }) {
      Vue.set(state.selectedVariations, groupId, variationId);
    },
    
    SET_VARIATION_QUANTITY(state, { variationId, quantity }) {
      Vue.set(state.variationQuantities, variationId, quantity);
    },
    
    CLEAR_VARIATIONS(state) {
      state.selectedVariations = {};
      state.variationQuantities = {};
    }
  },
  
  actions: {
    async selectVariation({ commit, dispatch }, payload) {
      commit('SET_VARIATION', payload);
      await dispatch('validateSelections');
      await dispatch('calculatePrice');
    }
  },
  
  getters: {
    totalPrice: (state, getters, rootState) => {
      // Calculate total including variations
      return rootState.product.price + getters.variationsPrice;
    }
  }
};
```

---

## Common Scenarios

### 1. Handling Out of Stock Variations
```javascript
// Auto-select next available option
handleStockChange(variation) {
  if (variation.stock === 0 && variation.is_default) {
    const group = this.findGroupByVariation(variation);
    const available = group.product_variations.find(v => 
      v.stock === null || v.stock > 0
    );
    
    if (available) {
      this.selectVariation(group.id, available.id);
      this.$toast.info(`${variation.name} agotado. Seleccionado ${available.name}`);
    }
  }
}
```

### 2. Bulk Variations Update
```javascript
// Update multiple variations at once
async updateBulkVariations(updates) {
  const promises = updates.map(update => 
    this.updateVariation(update.groupId, update.variationId)
  );
  
  await Promise.all(promises);
  this.recalculatePrice();
}
```

### 3. Variation Dependencies
```javascript
// Handle dependent variations (e.g., size affects available colors)
watch: {
  'selectedVariations.size': function(newSize) {
    // Reset color if not available for new size
    const availableColors = this.getAvailableColors(newSize);
    if (!availableColors.includes(this.selectedVariations.color)) {
      this.selectedVariations.color = availableColors[0]?.id || null;
    }
  }
}
```

---

## Troubleshooting

### Common Issues & Solutions

#### 1. Variations Not Showing
```javascript
// Check data structure
console.log('Product variations:', this.product.variations);
// Ensure variations are active
const activeVariations = this.product.variations?.filter(g => g.active);
```

#### 2. Price Not Updating
```javascript
// Force reactivity
this.$forceUpdate();
// Or use Vue.set
Vue.set(this.selectedVariations, groupId, variationId);
```

#### 3. Validation Not Working
```javascript
// Ensure validation runs after DOM update
await this.$nextTick();
this.validateSelections();
```

#### 4. Cart Not Accepting Variations
```javascript
// Verify variation format
console.log('Sending variations:', this.prepareVariationsForCart());
// Should be: [{variationId: 1, quantity: 1}, ...]
```

---

## Testing Checklist

- [ ] Required variations block add to cart
- [ ] Stock validation works correctly
- [ ] Price updates with each selection
- [ ] Multi-select respects max selections
- [ ] Default selections are pre-selected
- [ ] Cart displays variations correctly
- [ ] Variation quantities calculate properly
- [ ] Out of stock items are disabled
- [ ] Mobile UI works for variations
- [ ] Keyboard navigation functions
- [ ] Screen readers announce changes
- [ ] Variations persist in cart after refresh
- [ ] Edit cart item preserves variations

---

## Support & Resources

- API Documentation: `/api/docs`
- Frontend Examples: `/examples/variations`
- Database Schema: `/docs/database/variations.sql`
- Support Email: support@toutaunclicla.com

---

*Last Updated: December 2024*