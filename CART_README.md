# 🛒 Cart API Documentation

Comprehensive guide for the shopping cart functionality in ToutAunClicLa backend.

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Cart Operations](#cart-operations)
- [Product Variations](#product-variations)
- [Coupon System](#coupon-system)
- [Delivery Options](#delivery-options)
- [Shipping Calculator](#shipping-calculator)
- [Error Handling](#error-handling)

---

## Overview

The cart system provides complete shopping cart functionality including:
- Adding/removing products with variations
- Quantity management
- Coupon application and validation
- Advanced delivery scheduling (Montreal time zone)
- Smart shipping cost calculation
- Real-time cart totals with taxes (TPS/TVQ) and consigne

## Authentication

All cart endpoints require JWT authentication. Include the Bearer token in the Authorization header:

```http
Authorization: Bearer your-jwt-token-here
```

## Base URL

```
/api/v1/cart
```

---

## Cart Operations

### 1. Get Cart

**GET** `/`

Retrieves the user's cart with calculated totals, shipping costs, and applied coupons.

#### Query Parameters
- `page` (integer, optional): Page number for pagination (default: 1)
- `limit` (integer, optional): Items per page (default: 20)

#### Response Structure
```json
{
  "cartItems": [
    {
      "id": 123,
      "usuario_id": 456,
      "producto_id": 789,
      "cantidad": 2,
      "hora_entrega_preferida": "18:00",
      "metodo_entrega": "puerta",
      "tipo_entrega": "estandar",
      "notas_entrega": "Leave at door",
      "cupon_codigo": "SAVE10",
      "productos": {
        "id": 789,
        "nombre": "Product Name",
        "precio": 25.99,
        "categoria_id": 1,
        "stock": 50,
        "TPS": 5.0,
        "TVQ": 9.975,
        "consigne": 0.25,
        "averageRating": 4.5,
        "reviewCount": 12
      },
      "variations": [
        {
          "cart_item_id": 123,
          "variation_id": 10,
          "quantity": 1,
          "price_at_time": 2.50,
          "product_variations": {
            "id": 10,
            "name": "Extra Large",
            "price_modifier": 2.50
          }
        }
      ]
    }
  ],
  "total": 58.47,
  "itemCount": 3,
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 3,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "appliedCoupon": {
    "id": 1,
    "code": "SAVE10",
    "discount": 10,
    "type": "discount",
    "description": "10% de descuento"
  },
  "summary": {
    "totalItems": 3,
    "totalQuantity": 5,
    "subtotal": 51.98,
    "subtotalWithTaxes": 51.98,
    "subtotalWithConsigne": 25.99,
    "totalTPS": 2.60,
    "totalTVQ": 5.18,
    "totalConsigne": 0.50,
    "totalTaxes": 7.78,
    "shippingCost": 0,
    "originalShippingCost": 7,
    "shippingMessage": null,
    "needsAddress": false,
    "shippingThreshold": 200,
    "discountAmount": 5.20,
    "total": 58.47
  }
}
```

#### Example Request
```bash
curl -X GET "https://api.example.com/api/v1/cart?page=1&limit=10" \
  -H "Authorization: Bearer your-jwt-token"
```

---

### 2. Add Product to Cart

**POST** `/items`

Adds a product to the cart with optional variations and delivery preferences.

#### Request Body
```json
{
  "productId": 789,
  "quantity": 2,
  "horaEntregaPreferida": "18:00",
  "metodoEntrega": "puerta",
  "tipoEntrega": "estandar",
  "notasEntrega": "Leave at front door",
  "variations": [
    {
      "variationId": 10,
      "quantity": 1
    },
    {
      "variationId": 11,
      "quantity": 2
    }
  ]
}
```

#### Field Descriptions
- `productId` (required): Product ID to add
- `quantity` (required): Quantity to add
- `horaEntregaPreferida` (optional): Preferred delivery time in HH:MM format (default: "18:00")
- `metodoEntrega` (optional): Delivery method - `"puerta"`, `"manos"`, or `"recepcion"` (default: "puerta")
- `tipoEntrega` (optional): Delivery type - `"estandar"` or `"siguiente_dia"`
- `notasEntrega` (optional): Special delivery instructions
- `variations` (optional): Array of product variations with their quantities

#### Delivery Time Validation
- **Operating Hours**: 11:00 AM - 9:00 PM (Montreal time)
- **Order Cutoff**: 8:00 PM for same-day delivery
- **Minimum Notice**: 1 hour advance notice required
- **Early Morning**: 12:00 AM - 6:00 AM allows full day booking

#### Response
```json
{
  "message": "Item added to cart successfully",
  "cartItem": {
    "id": 123,
    "usuario_id": 456,
    "producto_id": 789,
    "cantidad": 2,
    "hora_entrega_preferida": "18:00",
    "metodo_entrega": "puerta",
    "tipo_entrega": "estandar"
  },
  "variations": 2,
  "deliveryInfo": {
    "type": "estandar",
    "description": "Entrega estándar (2-3 días hábiles)"
  }
}
```

#### Example Requests

**Simple Product Addition:**
```bash
curl -X POST "https://api.example.com/api/v1/cart/items" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 789,
    "quantity": 1
  }'
```

**Product with Variations:**
```bash
curl -X POST "https://api.example.com/api/v1/cart/items" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 789,
    "quantity": 1,
    "horaEntregaPreferida": "19:00",
    "metodoEntrega": "manos",
    "tipoEntrega": "siguiente_dia",
    "variations": [
      {"variationId": 10, "quantity": 1},
      {"variationId": 11, "quantity": 1}
    ]
  }'
```

---

### 3. Update Cart Item

**PUT** `/items/:id`

Updates quantity or delivery preferences for a specific cart item.

#### URL Parameters
- `id`: Cart item ID

#### Request Body
```json
{
  "quantity": 3,
  "horaEntregaPreferida": "19:30",
  "metodoEntrega": "recepcion",
  "tipoEntrega": "siguiente_dia",
  "notasEntrega": "Call before delivery"
}
```

#### Response
```json
{
  "message": "Cart item updated successfully",
  "cartItem": {
    "id": 123,
    "cantidad": 3,
    "hora_entrega_preferida": "19:30",
    "metodo_entrega": "recepcion"
  },
  "deliveryInfo": {
    "type": "siguiente_dia",
    "description": "Entrega programada para el día siguiente"
  }
}
```

#### Example Request
```bash
curl -X PUT "https://api.example.com/api/v1/cart/items/123" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3,
    "horaEntregaPreferida": "19:30"
  }'
```

---

### 4. Remove Item from Cart

**DELETE** `/items/:id`

Removes a specific item from the cart.

#### URL Parameters
- `id`: Cart item ID

#### Response
```json
{
  "message": "Item removed from cart successfully"
}
```

#### Example Request
```bash
curl -X DELETE "https://api.example.com/api/v1/cart/items/123" \
  -H "Authorization: Bearer your-jwt-token"
```

---

### 5. Clear Cart

**DELETE** `/`

Removes all items from the user's cart.

#### Response
```json
{
  "message": "Cart cleared successfully"
}
```

#### Example Request
```bash
curl -X DELETE "https://api.example.com/api/v1/cart" \
  -H "Authorization: Bearer your-jwt-token"
```

---

## Product Variations

The cart system supports complex product variations that modify the base product price.

### How Variations Work
1. Each variation has a `price_modifier` that adds to the base product price
2. Variations are stored with their price at the time of adding to cart
3. Multiple variations can be applied to a single product
4. Each variation can have its own quantity

### Example: Pizza with Toppings
```json
{
  "productId": 100,
  "quantity": 1,
  "variations": [
    {"variationId": 5, "quantity": 1},   // Extra Cheese (+$2.00)
    {"variationId": 8, "quantity": 2},   // Pepperoni (+$1.50 each)
    {"variationId": 12, "quantity": 1}   // Large Size (+$3.00)
  ]
}
```

**Final Price Calculation:**
- Base Pizza: $12.00
- Extra Cheese: +$2.00
- Pepperoni x2: +$3.00
- Large Size: +$3.00
- **Total: $20.00**

---

## Coupon System

The cart supports two types of coupons: discount coupons and free shipping coupons.

### 1. Apply Coupon

**POST** `/apply-coupon`

Applies a coupon code to the entire cart.

#### Rate Limiting
- 5 attempts per minute per user
- Prevents coupon brute force attacks

#### Request Body
```json
{
  "couponCode": "SAVE10"
}
```

#### Response
```json
{
  "message": "Coupon applied successfully",
  "coupon": {
    "id": 1,
    "code": "SAVE10",
    "discount": 10,
    "type": "discount",
    "description": "10% de descuento"
  },
  "cartSummary": {
    "subtotal": 51.98,
    "totalTPS": 2.60,
    "totalTVQ": 5.18,
    "totalConsigne": 0.50,
    "totalTaxes": 7.78,
    "shippingCost": 0,
    "originalShippingCost": 7,
    "discountAmount": 5.98,
    "total": 52.49,
    "itemCount": 3,
    "freeShippingApplied": false,
    "savings": 12.98
  }
}
```

### 2. Remove Coupon

**DELETE** `/remove-coupon`

Removes the currently applied coupon from the cart.

#### Response
```json
{
  "message": "Coupon removed successfully",
  "cartSummary": {
    "subtotal": 51.98,
    "totalTaxes": 7.78,
    "shippingCost": 7,
    "discountAmount": 0,
    "total": 67.26,
    "freeShippingApplied": false,
    "savings": 0
  }
}
```

### 3. Get Cart with Coupon Preview

**GET** `/with-coupon?couponCode=SAVE10`

Previews cart totals with a coupon without persisting it.

#### Query Parameters
- `couponCode`: Coupon code to preview

#### Example Request
```bash
curl -X GET "https://api.example.com/api/v1/cart/with-coupon?couponCode=SAVE10" \
  -H "Authorization: Bearer your-jwt-token"
```

### Coupon Types

#### Discount Coupons
- Apply percentage discount to subtotal + taxes + consigne (excluding shipping)
- Example: `SAVE10` = 10% off eligible items

#### Free Shipping Coupons
- Identified by codes starting with `ENVIO`, `SHIP`, `DOMICILIO`, or having 0% discount
- Waive shipping costs completely
- Example: `ENVIOGRATIS` = Free shipping

#### Example Requests
```bash
# Apply discount coupon
curl -X POST "https://api.example.com/api/v1/cart/apply-coupon" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "SAVE15"}'

# Apply free shipping coupon
curl -X POST "https://api.example.com/api/v1/cart/apply-coupon" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "ENVIOGRATIS"}'
```

---

## Delivery Options

### Update Delivery Options

**PUT** `/delivery-options`

Updates delivery preferences for the entire cart or individual items.

#### Request Body
```json
{
  "horaEntregaPreferida": "19:00",
  "metodoEntrega": "manos",
  "tipoEntrega": "siguiente_dia",
  "notasEntrega": "Ring doorbell twice",
  "aplicarATodos": true
}
```

#### Field Descriptions
- `horaEntregaPreferida`: Delivery time in HH:MM format (11:00-21:00)
- `metodoEntrega`: Delivery method:
  - `"puerta"`: Leave at door
  - `"manos"`: Hand delivery (signature required)
  - `"recepcion"`: Delivery to reception/concierge
- `tipoEntrega`: Delivery type:
  - `"estandar"`: Standard delivery (same day if ordered before 8 PM)
  - `"siguiente_dia"`: Next day delivery
- `notasEntrega`: Special delivery instructions
- `aplicarATodos`: Apply to all cart items (default: true)

#### Delivery Time Rules
1. **Operating Hours**: 11:00 AM - 9:00 PM (Montreal timezone)
2. **Same-Day Cutoff**: Orders after 8:00 PM automatically become next-day
3. **Early Morning Grace**: 12:00 AM - 6:00 AM can book same-day slots
4. **Minimum Notice**: 1 hour advance notice required

#### Response
```json
{
  "message": "Delivery options updated for entire cart",
  "updatedItems": 3,
  "deliveryOptions": {
    "horaEntregaPreferida": "19:00",
    "metodoEntrega": "manos",
    "notasEntrega": "Ring doorbell twice",
    "tipoEntrega": "siguiente_dia"
  },
  "deliveryInfo": {
    "type": "siguiente_dia",
    "description": "Entrega programada para el día siguiente"
  }
}
```

#### Example Request
```bash
curl -X PUT "https://api.example.com/api/v1/cart/delivery-options" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "horaEntregaPreferida": "20:00",
    "metodoEntrega": "recepcion",
    "tipoEntrega": "siguiente_dia",
    "aplicarATodos": true
  }'
```

---

## Shipping Calculator

The advanced shipping calculator determines costs based on:
- Cart subtotal (free shipping at $200+)
- Product categories (Products, Food, or Mixed)
- User location (Montreal vs Riviera Sur postal codes)
- Restaurant locations for food delivery

### Shipping Rules

#### 1. Free Shipping Threshold
- **$200+ subtotal**: Free shipping regardless of location or category

#### 2. Products Only (Categories 1, 3)
- **Montreal**: $17
- **Riviera Sur**: $7

#### 3. Food Only (Category 2)
- **Same postal zone**: $7
- **Same region**: $10
- **Cross-region**: $17

#### 4. Mixed Orders (Products + Food)
- **Minimum**: $10
- **Maximum**: $25
- Complex calculation based on restaurant locations

### Postal Code Zones

#### Montreal Zone
All postal codes except those listed below

#### Riviera Sur Zone
Postal codes starting with:
- J3V, J3W, J3X, J3Y, J3Z
- J4B, J4G, J4H, J4J, J4K, J4L, J4M, J4N, J4P, J4R, J4S, J4T, J4V, J4W, J4X, J4Y, J4Z
- J5A, J5B, J5C, J5J, J5K, J5L, J5M, J5R, J5T, J5V, J5W, J5X, J5Y, J5Z

### Example Shipping Calculations

```json
// Products only - Montreal user
{
  "items": [{"categoria_id": 1, "precio": 25, "cantidad": 2}],
  "userPostal": "H1A 1A1",
  "shippingCost": 17
}

// Food only - Same postal zone
{
  "items": [{"categoria_id": 2, "precio": 15, "cantidad": 1}],
  "userPostal": "J4B 1A1",
  "restaurantPostal": "J4B 2B2",
  "shippingCost": 7
}

// Mixed order - Riviera Sur
{
  "items": [
    {"categoria_id": 1, "precio": 30, "cantidad": 1},
    {"categoria_id": 2, "precio": 20, "cantidad": 1}
  ],
  "userPostal": "J5A 1A1",
  "shippingCost": 10
}

// Free shipping - High subtotal
{
  "items": [{"categoria_id": 1, "precio": 100, "cantidad": 3}],
  "subtotal": 300,
  "shippingCost": 0
}
```

---

## Error Handling

### Common Error Responses

#### 400 - Bad Request
```json
{
  "error": "Invalid request",
  "message": "Product quantity must be greater than 0"
}
```

#### 401 - Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

#### 404 - Not Found
```json
{
  "error": "Product not found",
  "message": "The requested product does not exist"
}
```

#### 429 - Too Many Requests
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

#### 500 - Server Error
```json
{
  "error": "Failed to add item to cart",
  "message": "Internal server error occurred"
}
```

### Validation Errors

#### Invalid Delivery Time
```json
{
  "error": "Invalid delivery configuration",
  "message": "Time 22:00 not available today. Available slots: 11:00, 11:30, 12:00, ...",
  "availableHours": ["11:00", "11:30", "12:00", "12:30", "13:00"]
}
```

#### Insufficient Stock
```json
{
  "error": "Insufficient stock",
  "message": "Only 3 items available"
}
```

#### Invalid Coupon
```json
{
  "error": "Invalid coupon",
  "message": "Has alcanzado el límite de uso para este cupón (5 veces)"
}
```

---

## Best Practices

### 1. Always Handle Cart State
```javascript
// Check cart total before proceeding to checkout
const cartResponse = await fetch('/api/v1/cart');
const cart = await cartResponse.json();

if (cart.itemCount === 0) {
  alert('Your cart is empty');
  return;
}

if (cart.summary.needsAddress) {
  // Redirect to address setup
  window.location.href = '/account/addresses';
  return;
}
```

### 2. Validate Delivery Times
```javascript
// Always provide available hours feedback
const addToCartData = {
  productId: 123,
  quantity: 1,
  horaEntregaPreferida: '22:00'  // Invalid time
};

const response = await fetch('/api/v1/cart/items', {
  method: 'POST',
  body: JSON.stringify(addToCartData)
});

if (!response.ok) {
  const error = await response.json();
  if (error.availableHours) {
    // Show available time slots to user
    showTimeSlots(error.availableHours);
  }
}
```

### 3. Monitor Cart Changes
```javascript
// Check for cart updates after any modification
const updateQuantity = async (itemId, newQuantity) => {
  const response = await fetch(`/api/v1/cart/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity: newQuantity })
  });
  
  if (response.ok) {
    // Refresh cart display
    await refreshCartDisplay();
  }
};
```

### 4. Handle Coupon Applications
```javascript
const applyCoupon = async (couponCode) => {
  try {
    const response = await fetch('/api/v1/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ couponCode })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Show savings to user
      if (result.cartSummary.savings > 0) {
        showSuccessMessage(`You saved $${result.cartSummary.savings}!`);
      }
      
      // Update cart display
      updateCartTotals(result.cartSummary);
    }
  } catch (error) {
    // Handle rate limiting
    if (error.status === 429) {
      showError('Too many coupon attempts. Please wait a minute.');
    }
  }
};
```

### 5. Implement Progressive Enhancement
```javascript
// Start with basic functionality, add features gradually
class CartManager {
  constructor() {
    this.loadBasicCart();
  }
  
  async loadBasicCart() {
    // Load cart items and basic totals
    const cart = await this.fetchCart();
    this.renderBasicCart(cart);
    
    // Then enhance with advanced features
    await this.loadShippingCalculations();
    await this.loadCouponStatus();
    await this.loadDeliveryOptions();
  }
}
```

---

## Complete Integration Example

```javascript
class ShoppingCart {
  constructor(apiBaseUrl, authToken) {
    this.apiUrl = `${apiBaseUrl}/api/v1/cart`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
  }

  // Add product with variations
  async addProduct(productId, quantity, variations = [], deliveryOptions = {}) {
    const payload = {
      productId,
      quantity,
      variations,
      ...deliveryOptions
    };

    const response = await fetch(`${this.apiUrl}/items`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.availableHours) {
        throw new CartError('Invalid delivery time', error.availableHours);
      }
      throw new Error(error.message);
    }

    return response.json();
  }

  // Apply coupon with preview
  async previewCoupon(couponCode) {
    const response = await fetch(`${this.apiUrl}/with-coupon?couponCode=${couponCode}`, {
      headers: this.headers
    });
    return response.json();
  }

  async applyCoupon(couponCode) {
    const response = await fetch(`${this.apiUrl}/apply-coupon`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ couponCode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new CouponError(error.message);
    }

    return response.json();
  }

  // Get full cart with all calculations
  async getCart(page = 1, limit = 20) {
    const response = await fetch(`${this.apiUrl}?page=${page}&limit=${limit}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Update delivery for entire cart
  async updateDeliveryOptions(options) {
    const response = await fetch(`${this.apiUrl}/delivery-options`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(options)
    });
    return response.json();
  }
}

// Usage example
const cart = new ShoppingCart('https://api.example.com', 'your-jwt-token');

// Add pizza with toppings and specific delivery time
await cart.addProduct(100, 1, [
  { variationId: 5, quantity: 1 },  // Extra cheese
  { variationId: 8, quantity: 2 }   // Pepperoni x2
], {
  horaEntregaPreferida: '19:30',
  metodoEntrega: 'manos',
  tipoEntrega: 'siguiente_dia',
  notasEntrega: 'Call when arriving'
});

// Preview and apply coupon
const preview = await cart.previewCoupon('SAVE15');
console.log(`You would save $${preview.summary.savings}`);

await cart.applyCoupon('SAVE15');

// Get final cart
const finalCart = await cart.getCart();
console.log(`Total: $${finalCart.total}`);
```

This comprehensive documentation covers all aspects of the cart API functionality, providing developers with the information needed to integrate the shopping cart system effectively.