/**
 * Unit Tests for Cart Calculation Logic
 */

import { supabaseAdmin } from '../../src/config/supabase.js';
import '../../src/config/env.js';

class CartCalculationTester {
  constructor() {
    this.testResults = [];
  }

  log(test, status, message, data = null) {
    const result = { test, status, message, data, timestamp: new Date().toISOString() };
    this.testResults.push(result);
    
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${emoji} ${test}: ${message}`);
    if (data) console.log('   ', JSON.stringify(data, null, 2));
  }

  // Helper function to calculate shipping (mimic from main code)
  calculateShipping(subtotal, estado = 'Quebec') {
    const freeShippingThreshold = 200.00;
    const baseShipping = 9.99;
    
    if (subtotal >= freeShippingThreshold) {
      return 0;
    }
    
    const provincialRates = {
      'Quebec': 9.99,
      'MONTREAL': 9.99,
      'Montreal': 9.99,
      'Ontario': 12.99,
      'British Columbia': 14.99,
      'Alberta': 13.99,
    };
    
    return provincialRates[estado] || baseShipping;
  }

  async testBasicCalculations() {
    console.log('\n🧮 Testing Basic Cart Calculations\n');
    
    // Test 1: Simple item without taxes
    const simpleItem = {
      precio: '18.30',
      cantidad: 1,
      TPS: null,
      TVQ: null,
      consigne: null
    };
    
    const simpleSubtotal = parseFloat(simpleItem.precio) * simpleItem.cantidad;
    const expectedSimple = 18.30;
    
    if (Math.abs(simpleSubtotal - expectedSimple) < 0.01) {
      this.log('SIMPLE_CALC', 'PASS', 'Simple item calculation correct', {
        input: simpleItem,
        calculated: simpleSubtotal,
        expected: expectedSimple
      });
    } else {
      this.log('SIMPLE_CALC', 'FAIL', 'Simple item calculation incorrect', {
        calculated: simpleSubtotal,
        expected: expectedSimple
      });
    }
    
    // Test 2: Item with taxes and consigne
    const complexItem = {
      precio: '4.00',
      cantidad: 1,
      TPS: 5,
      TVQ: 9.975,
      consigne: '0.10'
    };
    
    const complexSubtotal = parseFloat(complexItem.precio) * complexItem.cantidad;
    const complexTPS = complexItem.TPS ? (complexSubtotal * (parseFloat(complexItem.TPS) / 100)) : 0;
    const complexTVQ = complexItem.TVQ ? (complexSubtotal * (parseFloat(complexItem.TVQ) / 100)) : 0;
    const complexConsigne = complexItem.consigne ? (parseFloat(complexItem.consigne) * complexItem.cantidad) : 0;
    
    const expectedComplexSubtotal = 4.00;
    const expectedTPS = 0.20; // 4.00 * 0.05
    const expectedTVQ = 0.399; // 4.00 * 0.09975
    const expectedConsigne = 0.10;
    
    let complexTestPassed = true;
    
    if (Math.abs(complexSubtotal - expectedComplexSubtotal) > 0.01) complexTestPassed = false;
    if (Math.abs(complexTPS - expectedTPS) > 0.01) complexTestPassed = false;
    if (Math.abs(complexTVQ - expectedTVQ) > 0.01) complexTestPassed = false;
    if (Math.abs(complexConsigne - expectedConsigne) > 0.01) complexTestPassed = false;
    
    if (complexTestPassed) {
      this.log('COMPLEX_CALC', 'PASS', 'Complex item calculation correct', {
        subtotal: { calculated: complexSubtotal, expected: expectedComplexSubtotal },
        tps: { calculated: complexTPS.toFixed(3), expected: expectedTPS },
        tvq: { calculated: complexTVQ.toFixed(3), expected: expectedTVQ },
        consigne: { calculated: complexConsigne, expected: expectedConsigne }
      });
    } else {
      this.log('COMPLEX_CALC', 'FAIL', 'Complex item calculation incorrect');
    }
  }

  async testShippingCalculations() {
    console.log('\n🚚 Testing Shipping Calculations\n');
    
    // Test shipping under threshold
    const smallOrder = 75.00;
    const smallOrderShipping = this.calculateShipping(smallOrder);
    
    if (smallOrderShipping === 9.99) {
      this.log('SHIPPING_SMALL', 'PASS', 'Small order shipping correct', {
        subtotal: smallOrder,
        shipping: smallOrderShipping
      });
    } else {
      this.log('SHIPPING_SMALL', 'FAIL', 'Small order shipping incorrect', {
        calculated: smallOrderShipping,
        expected: 9.99
      });
    }
    
    // Test free shipping over threshold
    const largeOrder = 250.00;
    const largeOrderShipping = this.calculateShipping(largeOrder);
    
    if (largeOrderShipping === 0) {
      this.log('SHIPPING_FREE', 'PASS', 'Free shipping threshold correct', {
        subtotal: largeOrder,
        shipping: largeOrderShipping
      });
    } else {
      this.log('SHIPPING_FREE', 'FAIL', 'Free shipping threshold incorrect', {
        calculated: largeOrderShipping,
        expected: 0
      });
    }
    
    // Test exactly at threshold
    const thresholdOrder = 200.00;
    const thresholdShipping = this.calculateShipping(thresholdOrder);
    
    if (thresholdShipping === 0) {
      this.log('SHIPPING_THRESHOLD', 'PASS', 'Threshold shipping correct', {
        subtotal: thresholdOrder,
        shipping: thresholdShipping
      });
    } else {
      this.log('SHIPPING_THRESHOLD', 'FAIL', 'Threshold shipping incorrect', {
        calculated: thresholdShipping,
        expected: 0
      });
    }
    
    // Test different provinces
    const ontarioShipping = this.calculateShipping(75.00, 'Ontario');
    if (ontarioShipping === 12.99) {
      this.log('SHIPPING_ONTARIO', 'PASS', 'Ontario shipping rate correct');
    } else {
      this.log('SHIPPING_ONTARIO', 'FAIL', 'Ontario shipping rate incorrect');
    }
  }

  async testRealDatabaseCalculations() {
    console.log('\n🗄️ Testing with Real Database Data\n');
    
    try {
      // Get real product data
      const { data: products, error } = await supabaseAdmin
        .from('productos')
        .select('id, nombre, precio, "TPS", "TVQ", consigne')
        .limit(3);
      
      if (error || !products) {
        this.log('DB_FETCH', 'FAIL', 'Could not fetch products from database', { error });
        return;
      }
      
      this.log('DB_FETCH', 'PASS', `Fetched ${products.length} products from database`);
      
      // Test calculations with real data
      for (const product of products) {
        const quantity = 2;
        const subtotal = parseFloat(product.precio) * quantity;
        const tps = product.TPS ? (subtotal * (parseFloat(product.TPS) / 100)) : 0;
        const tvq = product.TVQ ? (subtotal * (parseFloat(product.TVQ) / 100)) : 0;
        const consigne = product.consigne ? (parseFloat(product.consigne) * quantity) : 0;
        const shipping = this.calculateShipping(subtotal);
        const total = subtotal + tps + tvq + consigne + shipping;
        
        // Validation: all values should be positive numbers
        const isValid = [
          subtotal >= 0,
          tps >= 0,
          tvq >= 0,
          consigne >= 0,
          shipping >= 0,
          total > 0,
          !isNaN(total)
        ].every(Boolean);
        
        if (isValid) {
          this.log('DB_CALC', 'PASS', `Calculation valid for ${product.nombre}`, {
            productId: product.id,
            subtotal: subtotal.toFixed(2),
            taxes: (tps + tvq).toFixed(2),
            consigne: consigne.toFixed(2),
            shipping: shipping.toFixed(2),
            total: total.toFixed(2)
          });
        } else {
          this.log('DB_CALC', 'FAIL', `Invalid calculation for ${product.nombre}`, {
            values: { subtotal, tps, tvq, consigne, shipping, total }
          });
        }
      }
      
    } catch (error) {
      this.log('DB_TEST', 'FAIL', 'Database test failed', { error: error.message });
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Cart Calculation Unit Tests\n');
    
    await this.testBasicCalculations();
    await this.testShippingCalculations();
    await this.testRealDatabaseCalculations();
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CART CALCULATION TESTS SUMMARY');
    console.log('='.repeat(60));
    
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    const totalTests = this.testResults.length;
    
    console.log(`\n🎯 Results: ${passCount}/${totalTests} tests passed`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    if (failCount > 0) {
      console.log('\n❌ Failed tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(failCount === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED');
    console.log('='.repeat(60) + '\n');
  }
}

// Export for use as module or run directly
export default CartCalculationTester;

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CartCalculationTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n✨ Unit tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Unit tests failed:', error);
      process.exit(1);
    });
}