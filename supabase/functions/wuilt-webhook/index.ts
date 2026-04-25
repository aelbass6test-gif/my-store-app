import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function mapWuiltOrder(order: any, storeId: string) {
  if (!order) return null;
  const id = `wuilt-${order.id}`;
  return {
    id,
    store_id: storeId,
    order_number: `W-${order.orderSerial || order.id}`,
    customer_name: order.customer?.name || 'عميل ويلت',
    status: 'في_انتظار_المكالمة',
    total_price: order.receipt?.total?.amount || 0,
    details: order,
    date: order.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // 1. Extract Store ID (from query param OR URL path)
  let storeId = url.searchParams.get("storeId");
  if (!storeId) {
      const pathParts = url.pathname.split('/');
      storeId = pathParts[pathParts.length - 1];
  }

  // Safety check for empty path
  if (storeId === 'wuilt-webhook' || !storeId) {
     return new Response(JSON.stringify({ error: "Missing storeId. Use ?storeId=xxx or /wuilt-webhook/xxx" }), { 
       status: 400, 
       headers: { ...corsHeaders, "Content-Type": "application/json" } 
     });
  }

  try {
    const payload = await req.json();

    // 2. Log receipt in database
    await supabase.from("webhook_logs").insert({
        store_id: storeId,
        platform: 'wuilt',
        payload: payload,
        status: 'received',
    });

    // 3. Process the event
    if (payload.event === 'ORDER_PLACED' || payload.event === 'ORDER_UPDATED') {
      const mappedOrder = mapWuiltOrder(payload.order, storeId);
      if (mappedOrder) {
        const { error: upsertError } = await supabase.from('orders').upsert(mappedOrder, { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }
    }

    // 4. Log Success
    await supabase.from("webhook_logs").insert({
        store_id: storeId,
        platform: 'wuilt',
        status: 'processed'
    });

    return new Response(JSON.stringify({ message: "Webhook processed successfully" }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    
    // 5. Log Error
    await supabase.from("webhook_logs").insert({
        store_id: storeId,
        platform: 'wuilt',
        status: 'error',
        error_details: error.message
    });

    return new Response(JSON.stringify({ error: "Failed to process", details: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
