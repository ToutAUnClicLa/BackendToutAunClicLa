import { supabaseAdmin } from '../config/supabase.js';

/**
 * Worker to automatically accept orders that have been in 'pagado' status for more than 5 minutes.
 */
export const startOrderAutoAcceptWorker = () => {
    console.log('🤖 Order Auto-Accept Worker started (Checking every 1 minute)');

    // Run every minute
    setInterval(async () => {
        try {
            const now = Date.now();
            const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
            const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();

            // 1. Auto-accept orders (pagado -> procesando after 5 min)
            const { data: ordersToAccept, error: acceptErr } = await supabaseAdmin
                .from('pedidos')
                .select('id')
                .eq('estado', 'pagado')
                .lt('fecha_pedido', fiveMinutesAgo);

            if (acceptErr) console.error('❌ Error fetching orders for auto-accept:', acceptErr.message);
            
            if (ordersToAccept && ordersToAccept.length > 0) {
                console.log(`🕒 Auto-accepting ${ordersToAccept.length} orders...`);
                for (const order of ordersToAccept) {
                    await supabaseAdmin.from('pedidos').update({ estado: 'procesando' }).eq('id', order.id);
                    console.log(`✅ Order #${order.id} auto-accepted`);
                }
            }

            // 2. [NEW] Auto-deliver orders (enviado -> entregado after 30 min)
            const { data: ordersToDeliver, error: deliverErr } = await supabaseAdmin
                .from('pedidos')
                .select('id')
                .eq('estado', 'enviado')
                .lt('fecha_pedido', thirtyMinutesAgo); 

            if (deliverErr) console.error('❌ Error fetching orders for auto-delivery:', deliverErr.message);

            if (ordersToDeliver && ordersToDeliver.length > 0) {
                console.log(`🚚 Auto-delivering ${ordersToDeliver.length} orders...`);
                for (const order of ordersToDeliver) {
                    await supabaseAdmin.from('pedidos').update({ estado: 'entregado' }).eq('id', order.id);
                    console.log(`📦 Order #${order.id} marked as auto-delivered`);
                }
            }
        } catch (error) {
            console.error('❌ Unexpected error in auto-accept worker:', error.message);
        }
    }, 60 * 1000); 
};
