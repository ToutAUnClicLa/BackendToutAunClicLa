/**
 * Test Configuration and Fixtures
 */

export const TEST_CONFIG = {
  // Test users (these should exist in your database)
  testUsers: {
    withCartAndAddress: {
      id: '4debb088-7396-4c8d-9df0-919c87615fe3',
      email: 'yuliacevedo05@gmail.com',
      name: 'Yuli Acevedo Esposa'
    },
    withoutCart: {
      id: '2f14a3a2-ec6e-46e3-b8b9-afa9eb382dcb',
      email: 'test@example.com'
    }
  },
  
  // Test products
  testProducts: {
    coffee: {
      id: 10,
      name: 'Café Mont Rose ® Espresso',
      price: 18.30,
      hasTax: false
    },
    drink: {
      id: 64,
      name: 'Postobon Colombiana 1.5L',
      price: 4.00,
      hasTax: true,
      tps: 5,
      tvq: 9.975,
      consigne: 0.10
    }
  },
  
  // Business rules
  businessRules: {
    freeShippingThreshold: 200.00,
    standardShipping: 9.99,
    defaultTPS: 5,
    defaultTVQ: 9.975
  },
  
  // Test scenarios
  scenarios: {
    smallOrder: {
      products: [{ id: 10, quantity: 1 }],
      expectedSubtotal: 18.30,
      expectsShipping: true
    },
    largeOrder: {
      products: [{ id: 10, quantity: 12 }],
      expectedSubtotal: 219.60,
      expectsShipping: false // Free shipping over $200
    }
  }
};

export const MOCK_STRIPE_RESPONSES = {
  successfulPaymentIntent: {
    id: 'pi_test_successful',
    status: 'succeeded',
    amount: 2800, // $28.00 in cents
    currency: 'cad',
    metadata: {
      user_id: '4debb088-7396-4c8d-9df0-919c87615fe3',
      shipping_address_id: '2bfa5be0-75b3-4978-91ce-ddce145c849b'
    }
  },
  
  failedPaymentIntent: {
    id: 'pi_test_failed',
    status: 'payment_failed',
    last_payment_error: {
      message: 'Your card was declined.'
    }
  }
};

export const SAMPLE_ADDRESSES = {
  montreal: {
    direccion: 'Calle 1A #19-71',
    ciudad: 'Montreal',
    estado: 'Quebec',
    codigo_postal: 'H1H 1Z1',
    pais: 'Canada'
  },
  
  toronto: {
    direccion: '123 Queen Street West',
    ciudad: 'Toronto',
    estado: 'Ontario',
    codigo_postal: 'M5H 2M9',
    pais: 'Canada'
  }
};

export default {
  TEST_CONFIG,
  MOCK_STRIPE_RESPONSES,
  SAMPLE_ADDRESSES
};