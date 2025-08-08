/**
 * Simple Test to verify everything works
 */

import { supabaseAdmin } from '../src/config/supabase.js';
import '../src/config/env.js';

console.log('🚀 Starting Simple Test...');

try {
  // Test 1: Basic calculations
  console.log('\n🧮 Testing basic calculations:');
  
  const testPrice = 18.30;
  const testQuantity = 1;
  const subtotal = testPrice * testQuantity;
  
  console.log(`  Price: $${testPrice}`);
  console.log(`  Quantity: ${testQuantity}`);
  console.log(`  Subtotal: $${subtotal}`);
  console.log(`  ✅ Basic calculation: ${subtotal === 18.30 ? 'PASS' : 'FAIL'}`);
  
  // Test 2: Shipping calculation
  console.log('\n🚚 Testing shipping calculations:');
  
  const calculateShipping = (subtotal) => {
    const threshold = 200.00;
    const standardShipping = 9.99;
    return subtotal >= threshold ? 0 : standardShipping;
  };
  
  const smallOrderShipping = calculateShipping(75.00);
  const largeOrderShipping = calculateShipping(250.00);
  
  console.log(`  Small order ($75): $${smallOrderShipping} - ${smallOrderShipping === 9.99 ? 'PASS' : 'FAIL'}`);
  console.log(`  Large order ($250): $${largeOrderShipping} - ${largeOrderShipping === 0 ? 'PASS' : 'FAIL'}`);
  
  // Test 3: Database connection
  console.log('\n🗄️ Testing database connection:');
  
  const { data: products, error } = await supabaseAdmin
    .from('productos')
    .select('id, nombre, precio')
    .limit(2);
  
  if (error) {
    console.log(`  ❌ Database error: ${error.message}`);
  } else {
    console.log(`  ✅ Database connected - fetched ${products.length} products:`);
    products.forEach(p => {
      console.log(`    - ${p.nombre}: $${p.precio}`);
    });
  }
  
  // Test 4: Environment variables
  console.log('\n🔧 Testing environment variables:');
  
  const requiredVars = [
    'SUPABASE_URL',
    'STRIPE_SECRET_KEY', 
    'RESEND_API_KEY'
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    const isSet = !!value;
    const prefix = isSet ? value.substring(0, 10) + '...' : 'NOT SET';
    console.log(`  ${varName}: ${isSet ? '✅' : '❌'} ${prefix}`);
  });
  
  console.log('\n🎉 Simple test completed!');
  
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}