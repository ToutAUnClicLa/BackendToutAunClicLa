import { supabaseAdmin } from '../config/supabase.js';

/**
 * Worker to automatically accept orders that have been in 'pagado' status for more than 5 minutes.
 */
export const startOrderAutoAcceptWorker = () => {
    console.log('🤖 Order Auto-Accept Worker started (Checking every 1 minute)');

    // Run every minute
    setInterval(async () => {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

            // 1. Find orders in 'pagado' status that were created more than 5 minutes ago
            const { data: orders, error } = await supabaseAdmin
                .from('pedidos')
                .select('id, estado, fecha_pedido')
                .eq('estado', 'pagado')
                .lt('fecha_pedido', fiveMinutesAgo);

            if (error) {
                console.error('❌ Error fetching orders for auto-accept:', error.message);
                return;
            }

            if (!orders || orders.length === 0) {
                return;
            }

            console.log(`🕒 Found ${orders.length} orders to auto-accept...`);

            // 2. Update each order to 'procesando'
            for (const order of orders) {
                const { error: updateErr } = await supabaseAdmin
                    .from('pedidos')
                    .update({ estado: 'procesando' })
                    .eq('id', order.id);

                if (updateErr) {
                    console.error(`❌ Failed to auto-accept order #${order.id}:`, updateErr.message);
                } else {
                    console.log(`✅ Order #${order.id} auto-accepted (Inactivity period exceeded)`);
                }
            }
        } catch (error) {
            console.error('❌ Unexpected error in auto-accept worker:', error.message);
        }
    }, 60 * 1000); // Check every 60 seconds
};
