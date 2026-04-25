import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { processors, defaultProcessor } from "./processors.ts";
import { verifySignature, sendWhatsAppAlert } from "./security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

const validateRequest = async (req: Request, platform: string, payload: string, storeId: string): Promise<boolean> => {
    const signature = req.headers.get(`x-${platform}-signature`);
    const { data: settings } = await supabase.from('webhook_settings').select('secret_key').eq('platform', platform).eq('store_id', storeId).single();
    const secret = settings?.secret_key || "default_secret";
    
    if (!signature) return false;
    return await verifySignature(payload, signature, secret);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId") || "";
  const platform = url.searchParams.get("platform") || "custom";

  if (!storeId) {
      return new Response(JSON.stringify({ error: "Missing storeId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const bodyText = await req.text();
    
    if (!(await validateRequest(req, platform, bodyText, storeId))) {
        return new Response(JSON.stringify({ error: "Unauthorized - Invalid Signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let payload: any = {};
    if (bodyText) {
        try { payload = JSON.parse(bodyText); } catch (e) { console.error("Body parse error:", e); }
    }

    if (!bodyText || payload.test || req.method === "GET") {
       return new Response(JSON.stringify({ message: "Webhook reached" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log the request
    await supabase.from("webhook_logs").insert({
        store_id: storeId,
        platform: platform,
        payload: payload,
        status: 'received',
    });

    const { data: storeRow } = await supabase.from("stores_data").select("id").eq("id", storeId).single();

    if (!storeRow) {
      return new Response(JSON.stringify({ error: "Store not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const processor = processors[platform] || defaultProcessor;
    const platformOrder = processor(payload, storeId);

    if (platformOrder) {
      const { error: upsertError } = await supabase.from("orders").upsert(platformOrder, { onConflict: 'id' });
      if (upsertError) throw upsertError;
    }

    await supabase.from("webhook_logs").insert({
        store_id: storeId,
        platform: platform,
        status: 'processed'
    });

    return new Response(JSON.stringify({ message: "Processed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Webhook error:", error);
    
    // Alert Admin
    await sendWhatsAppAlert(`Webhook Error in ${storeId}: ${error.message}`, platform, storeId);

    await supabase.from("webhook_logs").insert({
        store_id: storeId,
        platform: platform,
        status: 'error',
        error_details: error.message
    });

    return new Response(JSON.stringify({ error: "Server Error", details: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
