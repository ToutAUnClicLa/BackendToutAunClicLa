import { Resend } from 'resend';
import { supabaseAdmin } from '../config/supabase.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email templates
const generateReceiptHTML = (orderData) => {
  const {
    order,
    orderDetails,
    user,
    shippingAddress,
    paymentIntent
  } = orderData;

  const formatCurrency = (amount) => `$${parseFloat(amount).toFixed(2)} CAD`;
  const formatDate = (date) => new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Receipt - ToutAunClicLa</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f8f9fa;
          color: #333;
          line-height: 1.6;
        }
        
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        
        .header p {
          font-size: 16px;
          opacity: 0.9;
        }
        
        .content {
          padding: 30px;
        }
        
        .order-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        
        .order-info h3 {
          color: #495057;
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
        }
        
        .info-label {
          font-weight: 600;
          color: #6c757d;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        
        .info-value {
          color: #495057;
          font-size: 14px;
        }
        
        .section {
          margin-bottom: 30px;
        }
        
        .section h3 {
          color: #495057;
          margin-bottom: 15px;
          font-size: 18px;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 8px;
        }
        
        .product-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 0;
          border-bottom: 1px solid #e9ecef;
        }
        
        .product-item:last-child {
          border-bottom: none;
        }
        
        .product-info {
          flex: 1;
        }
        
        .product-name {
          font-weight: 600;
          color: #495057;
          margin-bottom: 5px;
        }
        
        .product-details {
          font-size: 14px;
          color: #6c757d;
        }
        
        .product-price {
          text-align: right;
          font-weight: 600;
          color: #495057;
        }
        
        .totals {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }
        
        .total-row.final {
          font-size: 18px;
          font-weight: 700;
          color: #495057;
          border-top: 2px solid #dee2e6;
          padding-top: 15px;
          margin-top: 15px;
        }
        
        .address-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
        }
        
        .footer {
          background: #495057;
          color: white;
          padding: 25px;
          text-align: center;
        }
        
        .footer h4 {
          margin-bottom: 10px;
        }
        
        .footer p {
          font-size: 14px;
          opacity: 0.8;
        }
        
        .payment-status {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .status-success {
          background: #d4edda;
          color: #155724;
        }
        
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          
          .info-grid {
            grid-template-columns: 1fr;
          }
          
          .product-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .product-price {
            text-align: left;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛍️ Order Confirmed!</h1>
          <p>Thank you for your purchase</p>
        </div>
        
        <div class="content">
          <div class="order-info">
            <h3>Order Details</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Order Number</div>
                <div class="info-value">#${order.id}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Order Date</div>
                <div class="info-value">${formatDate(order.fecha_pedido)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Payment Status</div>
                <div class="info-value">
                  <span class="payment-status status-success">Paid</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Items Ordered</h3>
            ${orderDetails.map(item => {
              const basePrice = parseFloat(item.productos.precio);
              const finalPrice = parseFloat(item.precio_unitario);
              const hasVariations = item.order_item_variations && item.order_item_variations.length > 0;
              const variationModifier = hasVariations ? finalPrice - basePrice : 0;
              
              return `
                <div class="product-item">
                  <div class="product-info">
                    <div class="product-name">${item.productos.nombre}</div>
                    ${hasVariations ? `
                      <div class="product-details" style="color: #6c757d; font-size: 13px; margin: 5px 0;">
                        <strong>Selected options:</strong>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                          ${item.order_item_variations.map(variation => `
                            <li>${variation.variation_name} ${variation.price_modifier > 0 ? `(+${formatCurrency(variation.price_modifier)})` : ''} 
                              ${variation.quantity > 1 ? `x${variation.quantity}` : ''}</li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    <div class="product-details">
                      ${hasVariations ? `
                        Base price: ${formatCurrency(basePrice)} ${variationModifier > 0 ? `+ ${formatCurrency(variationModifier)} (options)` : ''}<br>
                        Final price: ${formatCurrency(finalPrice)} × ${item.cantidad}
                      ` : `
                        Quantity: ${item.cantidad} × ${formatCurrency(item.precio_unitario)}
                      `}
                    </div>
                  </div>
                  <div class="product-price">
                    ${formatCurrency(item.cantidad * item.precio_unitario)}
                  </div>
                </div>
              `;
            }).join('')}
            
            <div class="totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(order.subtotal || 0)}</span>
              </div>
              ${order.impuestos_tps > 0 ? `
                <div class="total-row">
                  <span>TPS (${((order.impuestos_tps / order.subtotal) * 100).toFixed(1)}%):</span>
                  <span>${formatCurrency(order.impuestos_tps)}</span>
                </div>
              ` : ''}
              ${order.impuestos_tvq > 0 ? `
                <div class="total-row">
                  <span>TVQ (${((order.impuestos_tvq / order.subtotal) * 100).toFixed(1)}%):</span>
                  <span>${formatCurrency(order.impuestos_tvq)}</span>
                </div>
              ` : ''}
              ${order.costos_envio > 0 ? `
                <div class="total-row">
                  <span>Shipping:</span>
                  <span>${formatCurrency(order.costos_envio)}</span>
                </div>
              ` : ''}
              ${order.descuento > 0 ? `
                <div class="total-row">
                  <span>Discount${order.codigo_cupon ? ` (${order.codigo_cupon})` : ''}:</span>
                  <span>-${formatCurrency(order.descuento)}</span>
                </div>
              ` : ''}
              <div class="total-row final">
                <span>Total Paid:</span>
                <span>${formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
          
          ${shippingAddress ? `
            <div class="section">
              <h3>Shipping Address</h3>
              <div class="address-card">
                <div><strong>${user.nombre || 'N/A'}</strong></div>
                <div>${shippingAddress.direccion}</div>
                <div>${shippingAddress.ciudad}, ${shippingAddress.estado}</div>
                <div>${shippingAddress.codigo_postal}</div>
                <div>${shippingAddress.pais}</div>
              </div>
            </div>
          ` : ''}
          
          ${order.hora_entrega_preferida || order.metodo_entrega || order.notas_entrega ? `
            <div class="section">
              <h3>🚚 Delivery Information</h3>
              <div class="address-card">
                ${order.tipo_entrega ? `
                  <div style="margin-bottom: 10px;">
                    <strong>Delivery Type:</strong> 
                    ${order.tipo_entrega === 'siguiente_dia' ? 
                      '🏃‍♂️ Next Day Delivery' : 
                      '📦 Standard Delivery (2-3 business days)'
                    }
                  </div>
                ` : ''}
                ${order.hora_entrega_preferida ? `
                  <div style="margin-bottom: 8px;">
                    <strong>Preferred Time:</strong> ${order.hora_entrega_preferida}
                  </div>
                ` : ''}
                ${order.metodo_entrega ? `
                  <div style="margin-bottom: 8px;">
                    <strong>Delivery Method:</strong> 
                    ${order.metodo_entrega === 'puerta' ? '🚪 Leave at door' : 
                      order.metodo_entrega === 'manos' ? '👋 Hand delivery' : 
                      order.metodo_entrega === 'recepcion' ? '🏢 Leave at reception' : 
                      order.metodo_entrega}
                  </div>
                ` : ''}
                ${order.notas_entrega ? `
                  <div style="margin-bottom: 8px;">
                    <strong>Special Notes:</strong> ${order.notas_entrega}
                  </div>
                ` : ''}
                ${order.envio_gratis ? `
                  <div style="background: #d4edda; color: #155724; padding: 8px; border-radius: 4px; margin-top: 10px;">
                    <strong>✅ FREE SHIPPING APPLIED!</strong>
                    ${order.aplicado_envio_gratis && order.codigo_cupon ? 
                      ` Thanks to coupon ${order.codigo_cupon}` : 
                      order.costo_envio_original > 0 ? 
                        ` for orders over $200 CAD` : ''
                    }
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          <div class="section">
            <h3>What's Next?</h3>
            <p>We'll send you a shipping confirmation email with tracking information once your order ships.</p>
            <p><strong>Estimated delivery time:</strong> ${
              order.tipo_entrega === 'siguiente_dia' ? 
                'Next business day between 12:00 PM - 9:00 PM' : 
                '2-3 business days'
            }</p>
            ${order.hora_entrega_preferida ? `<p><strong>Your preferred delivery time:</strong> ${order.hora_entrega_preferida}</p>` : ''}
          </div>
        </div>
        
        <div class="footer">
          <h4>ToutAunClicLa</h4>
          <p>Thank you for shopping with us!</p>
          <p>If you have any questions, please contact us at serviceclient@toutaunclicla.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send order confirmation email
export const sendOrderConfirmationEmail = async (orderId) => {
  try {
    // Get complete order data with variations
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .select(`
        *,
        usuarios(correo_electronico, nombre),
        direcciones_envio(*),
        detalles_pedido(
          *,
          productos(nombre, precio, imagen_principal),
          order_item_variations(
            id,
            variation_id,
            variation_name,
            price_modifier,
            quantity
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Get payment intent details if available
    let paymentIntent = null;
    if (order.stripe_payment_intent_id) {
      try {
        const stripe = (await import('../config/stripe.js')).default;
        paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      } catch (stripeError) {
        console.error('Failed to retrieve payment intent:', stripeError);
        // Continue without payment intent details
      }
    }

    const emailData = {
      order,
      orderDetails: order.detalles_pedido,
      user: order.usuarios,
      shippingAddress: order.direcciones_envio,
      paymentIntent
    };

    const htmlContent = generateReceiptHTML(emailData);

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'ToutAunClicLa <orders@toutaunclicla.com>',
      to: [order.usuarios.correo_electronico],
      subject: `Order Confirmation #${order.id} - ToutAunClicLa`,
      html: htmlContent,
      headers: {
        'X-Order-ID': order.id.toString(),
        'X-Payment-Intent': order.stripe_payment_intent_id || 'N/A'
      }
    });

    console.log('Order confirmation email sent:', emailResult);

    // Log email sent status
    await supabaseAdmin
      .from('pedidos')
      .update({ 
        email_confirmacion_enviado: true,
        fecha_email_enviado: new Date().toISOString()
      })
      .eq('id', orderId);

    return {
      success: true,
      emailId: emailResult.data?.id,
      message: 'Order confirmation email sent successfully'
    };

  } catch (error) {
    console.error('Send order confirmation email error:', error);
    
    // Log email failure
    await supabaseAdmin
      .from('pedidos')
      .update({ 
        email_confirmacion_enviado: false,
        notas_email: error.message
      })
      .eq('id', orderId);

    return {
      success: false,
      error: error.message
    };
  }
};

// Send payment failed email
export const sendPaymentFailedEmail = async (userId, paymentIntentId, errorMessage) => {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('correo_electronico, nombre')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Failed</h1>
          </div>
          <div class="content">
            <p>Hello ${user.nombre || 'Customer'},</p>
            
            <p>We encountered an issue processing your payment for your ToutAunClicLa order.</p>
            
            <p><strong>Payment ID:</strong> ${paymentIntentId}</p>
            <p><strong>Error:</strong> ${errorMessage}</p>
            
            <p>Please try again with a different payment method, or contact your bank if the issue persists.</p>
            
            <p>Your cart items are still saved and ready for checkout when you're ready to try again.</p>
            
            <a href="https://www.toutaunclicla.com/cart" class="button">Return to Cart</a>
            
            <p>If you need assistance, please contact our support team.</p>
            
            <p>Best regards,<br>The ToutAunClicLa Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResult = await resend.emails.send({
      from: 'ToutAunClicLa <orders@toutaunclicla.com>',
      to: [user.correo_electronico],
      subject: 'Payment Failed - ToutAunClicLa',
      html: htmlContent
    });

    return {
      success: true,
      emailId: emailResult.data?.id
    };

  } catch (error) {
    console.error('Send payment failed email error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send new order notification to admins
export const sendAdminOrderNotification = async (orderId) => {
  try {
    // Get complete order data with variations
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .select(`
        *,
        usuarios(correo_electronico, nombre, telefono),
        direcciones_envio(*),
        detalles_pedido(
          *,
          productos(nombre, precio, imagen_principal),
          order_item_variations(
            id,
            variation_id,
            variation_name,
            price_modifier,
            quantity
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const formatCurrency = (amount) => `$${parseFloat(amount).toFixed(2)} CAD`;
    const formatDate = (date) => new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Generate admin notification HTML
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order Notification - ToutAunClicLa</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
          .order-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .customer-info { background: #e9ecef; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .item { padding: 10px 0; border-bottom: 1px solid #eee; }
          .total { font-weight: bold; font-size: 18px; color: #28a745; }
          .urgent { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛒 New Order Received!</h1>
            <p>Order #${order.id}</p>
          </div>
          
          <div class="content">
            <div class="urgent">
              <strong>⏰ Action Required:</strong> New customer order needs processing
            </div>
            
            <div class="order-info">
              <h3>📋 Order Details</h3>
              <p><strong>Order ID:</strong> #${order.id}</p>
              <p><strong>Date:</strong> ${formatDate(order.fecha_pedido)}</p>
              <p><strong>Status:</strong> ${order.estado.toUpperCase()}</p>
              <p><strong>Payment:</strong> ${order.stripe_payment_intent_id ? 'PAID ✅' : 'PENDING ⏳'}</p>
              <p><strong>Total:</strong> <span class="total">${formatCurrency(order.total)}</span></p>
            </div>
            
            <div class="customer-info">
              <h3>👤 Customer Information</h3>
              <p><strong>Name:</strong> ${order.usuarios.nombre || 'N/A'}</p>
              <p><strong>Email:</strong> ${order.usuarios.correo_electronico}</p>
              <p><strong>Phone:</strong> ${order.usuarios.telefono || 'N/A'}</p>
            </div>
            
            ${order.direcciones_envio ? `
              <div class="customer-info">
                <h3>📍 Shipping Address</h3>
                <p>${order.direcciones_envio.direccion}</p>
                <p>${order.direcciones_envio.ciudad}, ${order.direcciones_envio.estado}</p>
                <p>${order.direcciones_envio.codigo_postal}, ${order.direcciones_envio.pais}</p>
              </div>
            ` : ''}
            
            <div class="customer-info">
              <h3>🚚 Delivery Instructions</h3>
              <div style="background: ${order.tipo_entrega === 'siguiente_dia' ? '#fff3cd' : '#d4edda'}; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                <strong>Delivery Type:</strong> 
                ${order.tipo_entrega === 'siguiente_dia' ? 
                  '🏃‍♂️ NEXT DAY DELIVERY (URGENT!)' : 
                  '📦 Standard Delivery (2-3 business days)'
                }
              </div>
              ${order.hora_entrega_preferida ? `
                <p><strong>⏰ Preferred Time:</strong> ${order.hora_entrega_preferida}</p>
              ` : ''}
              <p><strong>🚪 Delivery Method:</strong> 
                ${order.metodo_entrega === 'puerta' ? '🚪 Leave at door' : 
                  order.metodo_entrega === 'manos' ? '👋 Hand delivery (customer must be present)' : 
                  order.metodo_entrega === 'recepcion' ? '🏢 Leave at reception/front desk' : 
                  order.metodo_entrega || 'Standard delivery'}
              </p>
              ${order.notas_entrega ? `
                <div style="background: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 8px;">
                  <strong>📝 Customer Notes:</strong> ${order.notas_entrega}
                </div>
              ` : ''}
              ${order.envio_gratis ? `
                <div style="background: #d4edda; color: #155724; padding: 8px; border-radius: 4px; margin-top: 10px;">
                  <strong>✅ FREE SHIPPING:</strong>
                  ${order.aplicado_envio_gratis && order.codigo_cupon ? 
                    ` Coupon "${order.codigo_cupon}" applied (saved $${parseFloat(order.costo_envio_original || 0).toFixed(2)})` : 
                    order.costo_envio_original > 0 ? 
                      ` Qualified for free shipping (order > $200 CAD)` : 
                      ' Applied'
                  }
                </div>
              ` : ''}
            </div>
            
            <h3>📦 Items Ordered</h3>
            ${order.detalles_pedido.map(item => {
              const basePrice = parseFloat(item.productos.precio);
              const finalPrice = parseFloat(item.precio_unitario);
              const hasVariations = item.order_item_variations && item.order_item_variations.length > 0;
              const variationModifier = hasVariations ? finalPrice - basePrice : 0;
              
              return `
                <div class="item">
                  <strong>${item.productos.nombre}</strong>
                  ${hasVariations ? `
                    <div style="color: #666; font-size: 13px; margin: 5px 0;">
                      <strong>🎯 Customer selected:</strong>
                      <ul style="margin: 2px 0; padding-left: 15px;">
                        ${item.order_item_variations.map(variation => `
                          <li>${variation.variation_name} ${variation.price_modifier > 0 ? `(+${formatCurrency(variation.price_modifier)})` : ''}
                            ${variation.quantity > 1 ? ` x${variation.quantity}` : ''}</li>
                        `).join('')}
                      </ul>
                      <div style="background: #e9ecef; padding: 5px; border-radius: 3px; margin-top: 5px;">
                        💰 Base: ${formatCurrency(basePrice)} ${variationModifier > 0 ? `+ Options: ${formatCurrency(variationModifier)} = <strong>${formatCurrency(finalPrice)}</strong>` : ''}
                      </div>
                    </div>
                  ` : ''}
                  <div style="margin-top: 5px;">
                    Quantity: ${item.cantidad} × ${formatCurrency(item.precio_unitario)} = <strong>${formatCurrency(item.cantidad * item.precio_unitario)}</strong>
                  </div>
                </div>
              `;
            }).join('')}
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
              <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal || 0)}</p>
              ${order.impuestos_tps > 0 ? `<p><strong>TPS:</strong> ${formatCurrency(order.impuestos_tps)}</p>` : ''}
              ${order.impuestos_tvq > 0 ? `<p><strong>TVQ:</strong> ${formatCurrency(order.impuestos_tvq)}</p>` : ''}
              ${order.costos_envio > 0 ? `<p><strong>Shipping:</strong> ${formatCurrency(order.costos_envio)}</p>` : ''}
              ${order.descuento > 0 ? `<p><strong>Discount:</strong> -${formatCurrency(order.descuento)}</p>` : ''}
              <p class="total"><strong>TOTAL: ${formatCurrency(order.total)}</strong></p>
            </div>
            
            <div class="urgent">
              <h4>🎯 Next Steps:</h4>
              <ul>
                <li>✅ Verify inventory availability</li>
                <li>📦 Prepare items for ${order.tipo_entrega === 'siguiente_dia' ? 'NEXT DAY delivery' : 'standard shipping'}</li>
                ${order.tipo_entrega === 'siguiente_dia' ? 
                  '<li>⚡ <strong>URGENT:</strong> Must deliver tomorrow between 12:00 PM - 9:00 PM</li>' : 
                  '<li>🚚 Schedule delivery within 2-3 business days</li>'
                }
                ${order.hora_entrega_preferida ? 
                  `<li>⏰ <strong>Customer prefers delivery at:</strong> ${order.hora_entrega_preferida}</li>` : ''
                }
                ${order.metodo_entrega === 'manos' ? 
                  '<li>👋 <strong>Hand delivery required</strong> - customer must be present</li>' : 
                  order.metodo_entrega === 'recepcion' ? 
                    '<li>🏢 Leave at reception/front desk</li>' : 
                    '<li>🚪 Leave at door (standard)</li>'
                }
                <li>📧 Update order status when shipped</li>
                <li>📍 Provide tracking information to customer</li>
              </ul>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send only to serviceclient@toutaunclicla.com for all orders
    const adminEmails = ['serviceclient@toutaunclicla.com'];

    // Send email to all admins
    const emailResult = await resend.emails.send({
      from: 'ToutAunClicLa Orders <orders@toutaunclicla.com>',
      to: adminEmails,
      subject: `${order.tipo_entrega === 'siguiente_dia' ? '⚡ URGENT - Next Day' : '🛒'} New Order #${order.id} - ${formatCurrency(order.total)} - ${order.usuarios.nombre || order.usuarios.correo_electronico}`,
      html: adminHtmlContent,
      headers: {
        'X-Order-ID': order.id.toString(),
        'X-Customer-Email': order.usuarios.correo_electronico,
        'X-Priority': order.tipo_entrega === 'siguiente_dia' ? 'Urgent' : 'High',
        'X-Delivery-Type': order.tipo_entrega || 'estandar'
      }
    });

    console.log('Admin order notification sent:', emailResult);

    return {
      success: true,
      emailId: emailResult.data?.id,
      message: 'Admin notification sent successfully'
    };

  } catch (error) {
    console.error('Send admin order notification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send email when customer adds product with variations to cart (optional notification)
export const sendVariationNotificationEmail = async (userId, cartItemId, productName, variations) => {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('correo_electronico, nombre')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
          .variation { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 5px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛍️ Product Added to Cart!</h1>
          </div>
          <div class="content">
            <p>Hello ${user.nombre || 'Customer'},</p>
            
            <p>You've successfully added <strong>${productName}</strong> to your cart with the following options:</p>
            
            <div style="background: #e9ecef; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3>🎯 Your Selected Options:</h3>
              ${variations.map(v => `
                <div class="variation">
                  <strong>${v.name}</strong> ${v.price_modifier > 0 ? `(+$${v.price_modifier.toFixed(2)} CAD)` : ''}
                  ${v.quantity > 1 ? ` × ${v.quantity}` : ''}
                </div>
              `).join('')}
            </div>
            
            <p>Ready to checkout? Complete your order now!</p>
            
            <a href="https://www.toutaunclicla.com/cart" class="button">View Cart & Checkout</a>
            
            <p>Your cart will be saved for 30 days. You can always come back to complete your purchase later.</p>
            
            <p>Best regards,<br>The ToutAunClicLa Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResult = await resend.emails.send({
      from: 'ToutAunClicLa <notifications@toutaunclicla.com>',
      to: [user.correo_electronico],
      subject: `🛍️ ${productName} added to your cart - ToutAunClicLa`,
      html: htmlContent
    });

    return {
      success: true,
      emailId: emailResult.data?.id,
      message: 'Variation notification email sent successfully'
    };

  } catch (error) {
    console.error('Send variation notification email error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  sendOrderConfirmationEmail,
  sendPaymentFailedEmail,
  sendAdminOrderNotification,
  sendVariationNotificationEmail
};