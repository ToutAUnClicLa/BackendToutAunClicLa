import { Resend } from 'resend';
import { supabaseAdmin } from '../config/supabase.js';
import { IS_PRODUCTION, IS_DEVELOPMENT, RESEND_API_KEY } from '../config/env.js';
import { createWelcomeCoupon, getUserWelcomeCoupon } from './couponService.js';

const resend = new Resend(RESEND_API_KEY);

// Configuración de emails según el entorno
const EMAIL_CONFIG = {
  from: 'ToutAunClicLa <serviceclient@toutaunclicla.com>',
  restaurantFrom: 'ToutAunClicLa <order@toutaunclicla.com>',
  adminEmails: process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [],
  subjectPrefix: IS_DEVELOPMENT ? '[TEST] ' : ''
};

console.log(`📧 Email service configured for ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`📬 From: ${EMAIL_CONFIG.from}`);
console.log(`👥 Admin emails: ${EMAIL_CONFIG.adminEmails.join(', ')}`);

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
  const formatDate = (date) => new Date(date).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Montreal'
  });

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reçu de commande - ToutAunClicLa</title>
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
          <h1>🛍️ Commande confirmée!</h1>
          <p>Merci pour votre achat</p>
        </div>
        
        <div class="content">
          <div class="order-info">
            <h3>Détails de la commande</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Numéro de commande</div>
                <div class="info-value">#${order.id}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date de commande</div>
                <div class="info-value">${formatDate(order.fecha_pedido)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Statut du paiement</div>
                <div class="info-value">
                  <span class="payment-status status-success">Payé</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Articles commandés</h3>
            ${orderDetails.map(item => {
              const basePrice = parseFloat(item.productos.precio);
              const finalPrice = parseFloat(item.precio_unitario);
              
              return `
                <div class="product-item">
                  <div class="product-info">
                    <div class="product-name">${item.productos.nombre}</div>
                    <div class="product-details">
                        Quantité: ${item.cantidad} × ${formatCurrency(item.precio_unitario)}
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
                <span>Sous-total:</span>
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
                  <span>TVQ (${((order.impuestos_tvq / order.subtotal) * 100)}%):</span>
                  <span>${formatCurrency(order.impuestos_tvq)}</span>
                </div>
              ` : ''}
              ${order.costos_envio > 0 ? `
                <div class="total-row">
                  <span>Livraison:</span>
                  <span>${formatCurrency(order.costos_envio)}</span>
                </div>
              ` : ''}
              ${order.descuento > 0 ? `
                <div class="total-row">
                  <span>Remise${order.codigo_cupon ? ` (${order.codigo_cupon})` : ''}:</span>
                  <span>-${formatCurrency(order.descuento)}</span>
                </div>
              ` : ''}
              <div class="total-row final">
                <span>Total payé:</span>
                <span>${formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
          
          ${shippingAddress ? `
            <div class="section">
              <h3>Adresse de livraison</h3>
              <div class="address-card">
                <div><strong>${user.nombre || 'N/A'}</strong></div>
                <div>${shippingAddress.direccion}</div>
                <div>${shippingAddress.ciudad}, ${shippingAddress.estado}</div>
                <div>${shippingAddress.codigo_postal}</div>
                <div>${shippingAddress.pais}</div>
              </div>
            </div>
          ` : ''}
          
          ${order.metodo_entrega || order.notas_entrega ? `
            <div class="section">
              <h3>🚚 Informations de livraison</h3>
              <div class="address-card">
                ${order.metodo_entrega ? `
                  <div style="margin-bottom: 8px;">
                    <strong>Méthode de livraison:</strong>
                    ${order.metodo_entrega === 'puerta' ? '🚪 Laisser à la porte' :
                      order.metodo_entrega === 'manos' ? '👋 Livraison en mains propres' :
                      order.metodo_entrega === 'recepcion' ? '🏢 Laisser à la réception' :
                      order.metodo_entrega}
                  </div>
                ` : ''}
                ${order.notas_entrega ? `
                  <div style="margin-bottom: 8px;">
                    <strong>Notes pour le livreur:</strong> ${order.notas_entrega}
                  </div>
                ` : ''}
                ${order.envio_gratis ? `
                  <div style="background: #d4edda; color: #155724; padding: 8px; border-radius: 4px; margin-top: 10px;">
                    <strong>✅ LIVRAISON GRATUITE APPLIQUÉE!</strong>
                    ${order.aplicado_envio_gratis && order.codigo_cupon ? 
                      ` Grâce au coupon ${order.codigo_cupon}` : 
                      order.costo_envio_original > 0 ? 
                        ` pour les commandes de plus de 200 $ CAD` : ''
                    }
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          <div class="section">
            <h3>Prochaines étapes</h3>
            <p>Nous vous enverrons un email de confirmation d'expédition avec les informations de suivi une fois votre commande expédiée.</p>
          </div>
        </div>
        
        <div class="footer">
          <h4>ToutAunClicLa</h4>
          <p>Merci de magasiner avec nous!</p>
          <p>Si vous avez des questions, veuillez nous contacter à serviceclient@toutaunclicla.com</p>
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
          productos(nombre, precio, imagen_principal)
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
      from: EMAIL_CONFIG.from,
      to: [order.usuarios.correo_electronico],
      subject: `${EMAIL_CONFIG.subjectPrefix}Confirmation de commande #${order.id} - ToutAunClicLa`,
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
      <html lang="fr">
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
            <h1>Échec du paiement</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.nombre || 'Client'},</p>
            
            <p>Nous avons rencontré un problème lors du traitement de votre paiement pour votre commande ToutAunClicLa.</p>
            
            <p><strong>ID de paiement:</strong> ${paymentIntentId}</p>
            <p><strong>Erreur:</strong> ${errorMessage}</p>
            
            <p>Veuillez réessayer avec une méthode de paiement différente, ou contactez votre banque si le problème persiste.</p>
            
            <p>Vos articles dans le panier sont toujours sauvegardés et prêts pour la commande lorsque vous serez prêt à réessayer.</p>
            
            <a href="https://www.toutaunclicla.com/cart" class="button">Retourner au panier</a>
            
            <p>Si vous avez besoin d'aide, veuillez contacter notre équipe de support.</p>
            
            <p>Cordialement,<br>L'équipe ToutAunClicLa</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResult = await resend.emails.send({
      from: 'ToutAunClicLa <serviceclient@toutaunclicla.com>',
      to: [user.correo_electronico],
      subject: 'Échec du paiement - ToutAunClicLa',
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
          productos(
            nombre,
            precio,
            imagen_principal,
            subcategoria_id,
            subcategorias(
              nombre,
              categoria_id
            )
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const formatCurrency = (amount) => `$${parseFloat(amount).toFixed(2)} CAD`;
    const formatDate = (date) => new Date(date).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Montreal'
    });

    // Generate admin notification HTML
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notification de nouvelle commande - ToutAunClicLa</title>
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
            <h1>🛒 Nouvelle commande reçue!</h1>
            <p>Commande #${order.id}</p>
          </div>
          
          <div class="content">
            <div class="urgent">
              <strong>⏰ Action requise:</strong> Nouvelle commande client à traiter
            </div>
            
            <div class="order-info">
              <h3>📋 Détails de la commande</h3>
              <p><strong>ID Commande:</strong> #${order.id}</p>
              <p><strong>Date:</strong> ${formatDate(order.fecha_pedido)}</p>
              <p><strong>Statut:</strong> ${order.estado.toUpperCase()}</p>
              <p><strong>Paiement:</strong> ${order.stripe_payment_intent_id ? 'PAYÉ ✅' : 'EN ATTENTE ⏳'}</p>
              <p><strong>Total:</strong> <span class="total">${formatCurrency(order.total)}</span></p>
            </div>
            
            <div class="customer-info">
              <h3>👤 Informations client</h3>
              <p><strong>Nom:</strong> ${order.usuarios.nombre || 'N/A'}</p>
              <p><strong>Email:</strong> ${order.usuarios.correo_electronico}</p>
              <p><strong>Téléphone:</strong> ${order.usuarios.telefono || 'N/A'}</p>
            </div>
            
            ${order.direcciones_envio ? `
              <div class="customer-info">
                <h3>📍 Adresse de livraison</h3>
                <p>${order.direcciones_envio.direccion}</p>
                <p>${order.direcciones_envio.ciudad}, ${order.direcciones_envio.estado}</p>
                <p>${order.direcciones_envio.codigo_postal}, ${order.direcciones_envio.pais}</p>
              </div>
            ` : ''}
            
            <div class="customer-info">
              <h3>🚚 Instructions de livraison</h3>
              <div style="background: #d4edda; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                <strong>Type de livraison:</strong> 📦 Livraison standard
              </div>
              <p><strong>🚪 Méthode de livraison:</strong> 
                ${order.metodo_entrega === 'puerta' ? '🚪 Laisser à la porte' : 
                  order.metodo_entrega === 'manos' ? '👋 Livraison en mains propres (client doit être présent)' : 
                  order.metodo_entrega === 'recepcion' ? '🏢 Laisser à la réception/accueil' : 
                  order.metodo_entrega || 'Livraison standard'}
              </p>
              ${order.notas_entrega ? `
                <div style="background: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 8px;">
                  <strong>📝 Notes pour le livreur:</strong> ${order.notas_entrega}
                </div>
              ` : ''}
              ${order.envio_gratis ? `
                <div style="background: #d4edda; color: #155724; padding: 8px; border-radius: 4px; margin-top: 10px;">
                  <strong>✅ LIVRAISON GRATUITE:</strong>
                  ${order.aplicado_envio_gratis && order.codigo_cupon ? 
                    ` Coupon "${order.codigo_cupon}" appliqué (économie de $${parseFloat(order.costo_envio_original || 0).toFixed(2)})` : 
                    order.costo_envio_original > 0 ? 
                      ` Qualifié pour la livraison gratuite (commande > 200 $ CAD)` : 
                      ' Appliqué'
                  }
                </div>
              ` : ''}
            </div>
            
            <h3>📦 Articles commandés</h3>
            ${(() => {
              // Agrupar productos por tipo (restaurante vs productos generales)
              const restaurantItems = [];
              const generalItems = [];

              order.detalles_pedido.forEach(item => {
                const isRestaurant = item.productos.subcategorias &&
                                   item.productos.subcategorias.categoria_id === 2;
                if (isRestaurant) {
                  restaurantItems.push(item);
                } else {
                  generalItems.push(item);
                }
              });

              let html = '';

                      // Mostrar productos generales primero
              if (generalItems.length > 0) {
                html += `
                  <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745;">
                    <h4 style="margin: 0 0 10px 0; color: #28a745;">🛒 Produits ToutAunClicLa</h4>
                    ${generalItems.map(item => {
                      const finalPrice = parseFloat(item.precio_unitario);

                      return `
                        <div class="item" style="border-left: 3px solid #28a745; padding-left: 10px; margin-bottom: 15px;">
                          <strong>${item.productos.nombre}</strong>
                          <div style="margin-top: 5px;">
                            Quantité: ${item.cantidad} × ${formatCurrency(item.precio_unitario)} = <strong>${formatCurrency(item.cantidad * item.precio_unitario)}</strong>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              }

              // Mostrar productos de restaurantes agrupados
              if (restaurantItems.length > 0) {
                // Agrupar por restaurante
                const itemsByRestaurant = {};
                restaurantItems.forEach(item => {
                  const restaurantName = item.productos.subcategorias.nombre;
                  if (!itemsByRestaurant[restaurantName]) {
                    itemsByRestaurant[restaurantName] = [];
                  }
                  itemsByRestaurant[restaurantName].push(item);
                });

                // Renderizar cada restaurante
                Object.keys(itemsByRestaurant).forEach(restaurantName => {
                  html += `
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                      <h4 style="margin: 0 0 10px 0; color: #ff9800;">🍽️ Restaurant: ${restaurantName}</h4>
                      <div style="background: #ffecb3; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 12px;">
                        📧 <strong>Info:</strong> Ce restaurant recevra un email séparé avec uniquement ses produits
                      </div>
                      ${itemsByRestaurant[restaurantName].map(item => {
                        const finalPrice = parseFloat(item.precio_unitario);

                        return `
                          <div class="item" style="border-left: 3px solid #ff9800; padding-left: 10px; margin-bottom: 15px;">
                            <strong>${item.productos.nombre}</strong>
                            <div style="margin-top: 5px;">
                              Quantité: ${item.cantidad} × ${formatCurrency(item.precio_unitario)} = <strong>${formatCurrency(item.cantidad * item.precio_unitario)}</strong>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                });
              }

              return html;
            })()}
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
              <p><strong>Sous-total:</strong> ${formatCurrency(order.subtotal || 0)}</p>
              ${order.impuestos_tps > 0 ? `<p><strong>TPS:</strong> ${formatCurrency(order.impuestos_tps)}</p>` : ''}
              ${order.impuestos_tvq > 0 ? `<p><strong>TVQ:</strong> ${formatCurrency(order.impuestos_tvq)}</p>` : ''}
              ${order.costos_envio > 0 ? `<p><strong>Livraison:</strong> ${formatCurrency(order.costos_envio)}</p>` : ''}
              ${order.descuento > 0 ? `<p><strong>Remise:</strong> -${formatCurrency(order.descuento)}</p>` : ''}
              <p class="total"><strong>TOTAL: ${formatCurrency(order.total)}</strong></p>
            </div>
            
            <div class="urgent">
              <h4>🎯 Prochaines étapes:</h4>
              <ul>
                <li>✅ Vérifier la disponibilité des stocks</li>
                <li>📦 Préparer les articles pour expédition standard</li>
                <li>🚚 Programmer la livraison</li>
                ${order.metodo_entrega === 'manos' ?
                  '<li>👋 <strong>Livraison en mains propres requise</strong> - client doit être présent</li>' :
                  order.metodo_entrega === 'recepcion' ?
                    '<li>🏢 Laisser à la réception/accueil</li>' :
                    '<li>🚪 Laisser à la porte (standard)</li>'
                }
                <li>📧 Mettre à jour le statut de la commande lors de l'expédition</li>
                <li>📍 Fournir les informations de suivi au client</li>
              </ul>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Usar emails de admin desde configuración
    const adminEmails = EMAIL_CONFIG.adminEmails.length > 0 
      ? EMAIL_CONFIG.adminEmails 
      : ['serviceclient@toutaunclicla.com'];

    // Send email to all admins
    const emailResult = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: adminEmails,
      subject: `${EMAIL_CONFIG.subjectPrefix}🛒 Nouvelle commande #${order.id} - ${formatCurrency(order.total)} - ${order.usuarios.nombre || order.usuarios.correo_electronico}`,
      html: adminHtmlContent,
      headers: {
        'X-Order-ID': order.id.toString(),
        'X-Customer-Email': order.usuarios.correo_electronico,
        'X-Priority': 'High'
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


// Welcome email template for new users
const generateWelcomeEmailHTML = (userData, couponCode = null) => {
  const { nombre } = userData;
  
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta content="width=device-width, initial-scale=1.0" name="viewport">
      <title>
        Bienvenue chez ToutAunClicLa!
      </title>
      <style>
  * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #584ce3 100%); color: #333; line-height: 1.6; padding: 20px 0; } .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(88, 76, 227, 0.15); } .header { background: linear-gradient(135deg, #584ce3 0%, #667eea 100%); padding: 40px 30px; text-align: center; color: white; } .logo { width: 120px; height: 120px; margin: 0 auto 20px; background: white; border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); } .logo svg { width: 80px; height: 80px; } .welcome-text { font-size: 28px; font-weight: bold; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); } .subtitle { font-size: 16px; opacity: 0.9; font-weight: 300; } .content { padding: 40px 30px; } .greeting { font-size: 20px; color: #584ce3; margin-bottom: 20px; font-weight: 600; } .message { font-size: 16px; color: #555; margin-bottom: 30px; line-height: 1.8; } .benefit-card { background: linear-gradient(135deg, #584ce3 0%, #667eea 100%); color: white; padding: 30px; border-radius: 15px; margin: 30px 0; text-align: center; position: relative; overflow: hidden; } .benefit-card::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 50%); animation: shimmer 3s ease-in-out infinite; } @keyframes shimmer { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(180deg); } } .benefit-title { font-size: 24px; font-weight: bold; margin-bottom: 15px; position: relative; z-index: 1; } .benefit-description { font-size: 16px; margin-bottom: 20px; opacity: 0.95; position: relative; z-index: 1; } .coupon-code { background: rgba(255,255,255,0.2); padding: 15px 25px; border-radius: 50px; font-size: 20px; font-weight: bold; letter-spacing: 2px; border: 2px dashed rgba(255,255,255,0.5); display: inline-block; position: relative; z-index: 1; } .cta-section { text-align: center; margin: 40px 0; } .cta-button { background: linear-gradient(135deg, #584ce3 0%, #667eea 100%); color: white; padding: 15px 40px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 10px 25px rgba(88, 76, 227, 0.3); transition: all 0.3s ease; } .cta-button:hover { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(88, 76, 227, 0.4); } .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 40px 0; } .feature { text-align: center; padding: 20px; border-radius: 15px; background: #f8f9ff; border: 1px solid rgba(88, 76, 227, 0.1); } .feature-icon { font-size: 30px; margin-bottom: 10px; } .feature-title { font-weight: bold; color: #584ce3; margin-bottom: 5px; } .feature-description { font-size: 14px; color: #666; } .footer { background: #f8f9ff; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; } .footer-text { color: #666; font-size: 14px; margin-bottom: 15px; } .social-links { margin: 20px 0; } .social-link { display: inline-block; margin: 0 10px; color: #584ce3; text-decoration: none; } @media (max-width: 600px) { .container { margin: 10px; border-radius: 15px; } .header { padding: 30px 20px; } .content { padding: 30px 20px; } .logo { width: 100px; height: 100px; } .logo img { width: 60px; height: 60px; } .welcome-text { font-size: 24px; } .features { grid-template-columns: 1fr; } .cta-section div[style*="display: flex"] { flex-direction: column; align-items: center; } .cta-button { width: 90%; text-align: center; } }
</style>
<div class="container">
  <div class="header">
    <div esd-text="true" class="welcome-text esd-text">
      Bienvenue chez ToutAunClicLa!
    </div>
    <div esd-text="true" class="subtitle esd-text">
      Votre nouvelle destination pour des produits authentiques
    </div>
  </div>
  <div class="content">
    <div esd-text="true" class="greeting esd-text">
      Bonjour 👋
    </div>
    <div esd-text="true" class="message esd-text">
      Merci beaucoup de rejoindre notre belle communauté
      <strong>
        ToutAunClicLa.com
      </strong>
      . Nous sommes ravis de vous avoir avec nous et nous voulons vous accueillir avec quelque chose de très spécial.
    </div>
    <div class="benefit-card">
      <div esd-text="true" class="benefit-title esd-text">
        🎁 Vous avez gagné un avantage spécial!
      </div>
      <div esd-text="true" class="benefit-description esd-text">
        En tant que nouveau membre de notre famille, vous pourrez passer
        <strong>
          5 commandes
        </strong>
        dans notre zone de couverture, sans payer les frais de livraison. Activez le coupon suivant dans votre panier!
      </div>
      <div esd-text="true" class="coupon-code esd-text">
        ${couponCode || 'BIENVENIDO'}
      </div>
    </div>
    <div class="cta-section">
      <div esd-text="true" class="esd-text" style="margin-bottom: 30px; font-size: 18px; color: #584ce3; font-weight: 600">
        Commencez à profiter de vos commandes maintenant!
      </div>
      <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap">
        <a href="https://www.toutaunclicla.com/productos" class="cta-button" style="margin-bottom: 10px; color: white">
          Explorer Produits 🛍️
        </a>
        <a href="https://www.toutaunclicla.com/comidas" class="cta-button" style="margin-bottom: 10px; color: white">
          Explorer Restaurants 🍽️
        </a>
        <a href="https://www.toutaunclicla.com/boutique" class="cta-button" style="margin-bottom: 10px; color: white">
          Explorer Souvenirs 🎁
        </a>
      </div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">
      <strong>
        ToutAunClicLa
      </strong>
      - Votre boutique en ligne de confiance
      <br>
      www.toutaunclicla.com
    </div>
    <div class="social-links">
      <a href="https://www.toutaunclicla.com" class="social-link">
        📞 Contact: serviceclient@toutaunclicla.com
      </a>
    </div>
    <div esd-text="true" class="esd-text" style="color: #999; font-size: 12px; margin-top: 20px">
      Vous avez reçu cet email car vous vous êtes inscrit sur ToutAunClicLa.com
      <br>
      VALABLE POUR LE MOIS DE SEPTEMBRE. 5 commandes par compte dans la zone de couverture. S'applique uniquement à la livraison standard. Non transférable ni cumulable.
      <a href="https://www.toutaunclicla.com/terminos">
        Termes et conditions s'appliquent
      </a>
    </div>
  </div>
</div>
    </body>
    </html>
  `;
};

// Send welcome email to new users
const sendWelcomeEmail = async (userId) => {
  try {
    console.log('📧 Preparing to send welcome email for user:', userId);

    // Get user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('nombre, correo_electronico')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`);
    }

    // Check if user already has a welcome coupon, if not create one
    let couponCode = null;
    try {
      // First check if user already has a coupon
      let coupon = await getUserWelcomeCoupon(userId);

      if (!coupon) {
        // Create new welcome coupon
        coupon = await createWelcomeCoupon(userId, user.nombre, user.correo_electronico);
        console.log('🎁 Welcome coupon created:', coupon.codigo);
      }

      couponCode = coupon?.codigo;
    } catch (couponError) {
      console.error('⚠️ Failed to create/get welcome coupon:', couponError);
    }

    const htmlContent = generateWelcomeEmailHTML(user, couponCode);

    const emailResult = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: user.correo_electronico,
      subject: `Bonjour ${user.nombre || 'Ami'}`,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': `welcome-${userId}`,
        'X-Priority': '3',
        'X-Mailer': 'ToutAunClicLa Customer Service',
        'List-Unsubscribe': '<https://www.toutaunclicla.com/unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      },
    });

    console.log('✅ Welcome email sent successfully:', {
      userId,
      email: user.correo_electronico,
      emailId: emailResult.data?.id
    });

    return {
      success: true,
      emailId: emailResult.data?.id,
      message: 'Welcome email sent successfully'
    };

  } catch (error) {
    console.error('❌ Send welcome email error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send restaurant-specific order notification
export const sendRestaurantOrderEmail = async (orderId, restaurantId) => {
  try {
    // Get restaurant email
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('subcategorias')
      .select('nombre, gmail')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant || !restaurant.gmail) {
      console.log(`No email configured for restaurant ${restaurantId}`);
      return { success: false, message: 'No email configured for restaurant' };
    }

    // Get order data with only restaurant-specific products
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .select(`
        *,
        usuarios(correo_electronico, nombre, telefono),
        direcciones_envio(*),
        detalles_pedido!inner(
          *,
          productos!inner(
            nombre, 
            precio, 
            imagen_principal, 
            subcategoria_id,
            TPS,
            TVQ,
            consigne,
            ecoprecio
          )
        )
      `)
      .eq('id', orderId)
      .eq('detalles_pedido.productos.subcategoria_id', restaurantId)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order for restaurant:', orderError);
      return { success: false, error: 'Order not found for restaurant' };
    }

    // Filter only items from this restaurant
    const restaurantItems = order.detalles_pedido.filter(
      item => item.productos.subcategoria_id === restaurantId
    );

    if (restaurantItems.length === 0) {
      return { success: false, message: 'No items from this restaurant in order' };
    }

    // Calculate restaurant-specific totals with taxes
    let restaurantSubtotal = 0;
    let restaurantTPS = 0;
    let restaurantTVQ = 0;
    let restaurantConsigne = 0;
    
    restaurantItems.forEach(item => {
      const finalPrice = parseFloat(item.precio_unitario);
      const itemSubtotal = finalPrice * item.cantidad;
      const tpsRate = item.productos.TPS || 0;
      const tvqRate = item.productos.TVQ || 0;
      const consigne = item.productos.consigne || 0;
      
      restaurantSubtotal += itemSubtotal;
      if (tpsRate > 0) {
        restaurantTPS += (finalPrice * tpsRate / 100) * item.cantidad;
      }
      if (tvqRate > 0) {
        restaurantTVQ += (finalPrice * tvqRate / 100) * item.cantidad;
      }
      if (consigne > 0) {
        restaurantConsigne += consigne * item.cantidad;
      }
    });
    
    const restaurantTotal = restaurantSubtotal + restaurantTPS + restaurantTVQ + restaurantConsigne;

    const formatCurrency = (amount) => `$${parseFloat(amount).toFixed(2)} CAD`;
    const formatDate = (date) => new Date(date).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Montreal'
    });

    // Generate restaurant-specific HTML
    const restaurantHtmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle commande - ${restaurant.nombre}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background-color: #f8f9fa; 
            color: #333; 
            line-height: 1.6;
          }
          .container { 
            max-width: 700px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); 
            color: white; 
            padding: 30px; 
            text-align: center;
          }
          .header h1 { 
            font-size: 28px; 
            margin-bottom: 10px;
          }
          .urgent-banner {
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            text-align: center;
            font-weight: bold;
            border-bottom: 3px solid #ffc107;
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
          .customer-section {
            background: #e3f2fd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 4px solid #2196f3;
          }
          .delivery-section {
            background: #fff3e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 4px solid #ff9800;
          }
          .items-section {
            margin-bottom: 25px;
          }
          .item-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .item-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 10px;
          }
          .item-name {
            font-weight: 600;
            font-size: 18px;
            color: #495057;
          }
          .item-quantity {
            background: #28a745;
            color: white;
            padding: 5px 10px;
            border-radius: 20px;
            font-weight: bold;
          }
          .variations {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 6px;
            margin: 10px 0;
          }
          .total-section {
            background: #e8f5e9;
            border-radius: 8px;
            padding: 20px;
            margin-top: 25px;
            border: 2px solid #4caf50;
          }
          .total-amount {
            font-size: 24px;
            font-weight: bold;
            color: #2e7d32;
            text-align: center;
          }
          .action-required {
            background: #ffebee;
            border: 2px dashed #f44336;
            border-radius: 8px;
            padding: 20px;
            margin-top: 25px;
          }
          .footer {
            background: #495057;
            color: white;
            padding: 25px;
            text-align: center;
          }
          h3 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 18px;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 8px;
          }
          .label {
            font-weight: 600;
            color: #6c757d;
            display: inline-block;
            min-width: 120px;
          }
          .value {
            color: #495057;
          }
          .highlight {
            background: #ffc107;
            color: #000;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍽️ Nouvelle Commande!</h1>
            <p>${restaurant.nombre}</p>
          </div>
          
          
          <div class="content">
            <div class="order-info">
              <h3>📋 Détails de la Commande</h3>
              <p><span class="label">Numéro:</span> <span class="value">#${order.id}</span></p>
              <p><span class="label">Date:</span> <span class="value">${formatDate(order.fecha_pedido)}</span></p>
              <p><span class="label">Articles:</span> <span class="value">${restaurantItems.length} produit(s)</span></p>
              <p><span class="label">Statut paiement:</span> <span class="highlight">PAYÉ ✅</span></p>
            </div>
            
            
            <div class="items-section">
              <h3>🛒 Articles à Préparer</h3>
              ${restaurantItems.map(item => {
                const finalPrice = parseFloat(item.precio_unitario);

                // Calcul des taxes pour cet article
                const tpsRate = item.productos.TPS || 0;
                const tvqRate = item.productos.TVQ || 0;
                const consigne = item.productos.consigne || 0;
                const tpsAmount = tpsRate > 0 ? (finalPrice * tpsRate / 100) * item.cantidad : 0;
                const tvqAmount = tvqRate > 0 ? (finalPrice * tvqRate / 100) * item.cantidad : 0;
                const consigneTotal = consigne * item.cantidad;

                return `
                  <div class="item-card">
                    <div class="item-header">
                      <div class="item-name">${item.productos.nombre}</div>
                      <div class="item-quantity">×${item.cantidad}</div>
                    </div>

                    <div style="font-size: 14px; color: #495057;">
                      <div><strong>Prix:</strong> ${formatCurrency(finalPrice)}</div>
                      ${tpsAmount > 0 ? `<div><strong>TPS:</strong> ${formatCurrency(tpsAmount)}</div>` : ''}
                      ${tvqAmount > 0 ? `<div><strong>TVQ:</strong> ${formatCurrency(tvqAmount)}</div>` : ''}
                      ${consigneTotal > 0 ? `<div><strong>Consigne:</strong> ${formatCurrency(consigneTotal)}</div>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${order.notas_entrega ? `
              <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; border-color: #ffc107;">📝 Notes Spéciales du Client</h3>
                <p style="font-size: 16px; color: #856404; margin: 0;">
                  ${order.notas_entrega}
                </p>
              </div>
            ` : ''}
            
            
            <div class="action-required">
              <h3 style="color: #f44336; border-color: #f44336;">🎯 ACTION REQUISE</h3>
              <ol style="margin-left: 20px; font-size: 16px;">
                <li><strong>Confirmer</strong> la réception de cette commande</li>
                <li><strong>Préparer</strong> les articles listés ci-dessus</li>
                <li><strong>Avoir la commande prête</strong> pour collecte par notre équipe de livraison</li>
                <li><strong>Attendre</strong> notre équipe de collecte</li>
              </ol>
            </div>
          </div>
          
          <div class="footer">
            <h4>ToutAunClicLa - Plateforme de Commande</h4>
            <p><strong>✅ Commande payée et confirmée</strong> - Préparation requise</p>
            <p>📧 Questions: serviceclient@toutaunclicla.com | 📞 Urgent: +1 (438) 468-1855</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to restaurant
    console.log(`📤 Attempting to send email to restaurant...`, {
      from: EMAIL_CONFIG.restaurantFrom,
      to: restaurant.gmail,
      restaurantName: restaurant.nombre,
      orderId: order.id
    });

    const emailResult = await resend.emails.send({
      from: EMAIL_CONFIG.restaurantFrom,
      to: [restaurant.gmail],
      subject: `${EMAIL_CONFIG.subjectPrefix}🍽️ Nouvelle commande #${order.id} - ${restaurant.nombre}`,
      html: restaurantHtmlContent,
      headers: {
        'X-Order-ID': order.id.toString(),
        'X-Restaurant-ID': restaurantId.toString(),
        'X-Priority': 'High'
      }
    });

    console.log(`📬 Resend API Response:`, {
      data: emailResult.data,
      error: emailResult.error,
      fullResponse: JSON.stringify(emailResult, null, 2)
    });

    // Check for errors in Resend response
    if (emailResult.error) {
      console.error(`❌ Resend returned error:`, emailResult.error);
      throw new Error(`Resend API error: ${JSON.stringify(emailResult.error)}`);
    }

    if (!emailResult.data?.id) {
      console.error(`❌ No email ID returned from Resend`, emailResult);
      throw new Error(`No email ID in Resend response`);
    }

    console.log(`✅ Restaurant order email sent to ${restaurant.nombre} (${restaurant.gmail})`);

    return {
      success: true,
      emailId: emailResult.data?.id,
      restaurant: restaurant.nombre,
      email: restaurant.gmail
    };

  } catch (error) {
    console.error('Send restaurant order email error:', error);
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
  sendWelcomeEmail,
  sendRestaurantOrderEmail
};