// Prueba de opciones de entrega del carrito
// Para ejecutar: node tests/delivery-options-test.js

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';
let authToken = '';

// Función auxiliar para hacer peticiones autenticadas
async function authenticatedRequest(endpoint, options = {}) {
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      ...options.headers
    }
  });
}

// Test de configuración de opciones de entrega
async function testDeliveryOptions() {
  console.log('🧪 Iniciando pruebas de opciones de entrega...\n');

  try {
    // 1. Agregar un producto al carrito primero
    console.log('📦 Agregando producto al carrito...');
    const addToCartResponse = await authenticatedRequest('/cart/items', {
      method: 'POST',
      body: JSON.stringify({
        productId: 1,
        quantity: 2
      })
    });

    if (!addToCartResponse.ok) {
      console.log('❌ Error agregando al carrito:', await addToCartResponse.text());
      return;
    }

    console.log('✅ Producto agregado al carrito');

    // 2. Configurar opciones de entrega para todo el carrito (comportamiento por defecto)
    console.log('\n🕐 Configurando opciones de entrega para todo el carrito...');
    const defaultDeliveryResponse = await authenticatedRequest('/cart/delivery-options', {
      method: 'PUT',
      body: JSON.stringify({
        horaEntregaPreferida: '19:00',
        metodoEntrega: 'puerta',
        notasEntrega: 'Tocar el timbre dos veces'
        // aplicarATodos: true es el valor por defecto
      })
    });

    if (defaultDeliveryResponse.ok) {
      const result = await defaultDeliveryResponse.json();
      console.log('✅ Opciones para todo el carrito configuradas:', result);
    } else {
      console.log('❌ Error configurando opciones para todo el carrito:', await defaultDeliveryResponse.text());
    }

    // 3. Actualizar opciones de entrega antes del checkout
    console.log('\n� Actualizando opciones antes del checkout...');
    const checkoutDeliveryResponse = await authenticatedRequest('/cart/delivery-options', {
      method: 'PUT',
      body: JSON.stringify({
        horaEntregaPreferida: '20:30',
        metodoEntrega: 'manos',
        notasEntrega: 'Entregar directamente al cliente - Llamar al llegar'
        // aplicarATodos es true por defecto, perfecto para checkout
      })
    });

    if (checkoutDeliveryResponse.ok) {
      const result = await checkoutDeliveryResponse.json();
      console.log('✅ Opciones de checkout actualizadas:', result);
    } else {
      console.log('❌ Error actualizando opciones de checkout:', await checkoutDeliveryResponse.text());
    }

    // 4. Verificar el carrito actualizado
    console.log('\n📋 Verificando carrito actualizado...');
    const cartResponse = await authenticatedRequest('/cart');
    
    if (cartResponse.ok) {
      const cart = await cartResponse.json();
      console.log('✅ Carrito actualizado:', JSON.stringify(cart, null, 2));
    } else {
      console.log('❌ Error obteniendo carrito:', await cartResponse.text());
    }

    // 5. Probar validaciones (hora inválida)
    console.log('\n⚠️  Probando validación de hora inválida...');
    const invalidHourResponse = await authenticatedRequest('/cart/delivery-options', {
      method: 'PUT',
      body: JSON.stringify({
        horaEntregaPreferida: '11:00', // Antes de 12:00 PM
        metodoEntrega: 'puerta'
      })
    });

    if (!invalidHourResponse.ok) {
      const error = await invalidHourResponse.json();
      console.log('✅ Validación funcionando correctamente:', error.message);
    } else {
      console.log('❌ La validación debería haber fallado');
    }

    // 6. Probar validaciones (método inválido)
    console.log('\n⚠️  Probando validación de método inválido...');
    const invalidMethodResponse = await authenticatedRequest('/cart/delivery-options', {
      method: 'PUT',
      body: JSON.stringify({
        horaEntregaPreferida: '18:00',
        metodoEntrega: 'helicoptero' // Método no válido
      })
    });

    if (!invalidMethodResponse.ok) {
      const error = await invalidMethodResponse.json();
      console.log('✅ Validación funcionando correctamente:', error.message);
    } else {
      console.log('❌ La validación debería haber fallado');
    }

    console.log('\n🎉 Pruebas completadas exitosamente!');

  } catch (error) {
    console.log('💥 Error en las pruebas:', error.message);
  }
}

// Función principal para ejecutar las pruebas
async function runTests() {
  console.log('🚀 Sistema de pruebas de opciones de entrega\n');
  
  // Nota: En un entorno real, necesitarías obtener un token válido
  console.log('⚠️  Para ejecutar estas pruebas necesitas:');
  console.log('1. Servidor backend ejecutándose en http://localhost:3000');
  console.log('2. Token de autenticación válido');
  console.log('3. Al menos un producto en la base de datos\n');
  
  // authToken = 'TU_TOKEN_AQUI'; // Descomenta y agrega un token válido
  
  if (!authToken) {
    console.log('❌ Por favor, configura un token de autenticación válido en la variable authToken');
    return;
  }
  
  await testDeliveryOptions();
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testDeliveryOptions };
