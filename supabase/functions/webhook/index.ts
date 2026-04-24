import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // We will support fetching params via query sting for easier integration
    // Example: https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId=123&platform=wuilt
    let storeId = url.searchParams.get("storeId") || "";
    let platform = url.searchParams.get("platform") || "custom";

    // Fallbacks for path-based parameters if someone used the old API schema on Edge Functions
    if (!storeId) {
        if (pathParts.includes('platform')) {
            const pIndex = pathParts.indexOf('platform');
            platform = pathParts[pIndex + 1] || platform;
            storeId = pathParts[pIndex + 2] || storeId;
        } else if (pathParts.includes('orders')) {
            const oIndex = pathParts.indexOf('orders');
            storeId = pathParts[oIndex - 1] || storeId; 
        }
    }

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: "Missing storeId in request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();

    // Respond positively to verification pings / tests
    if (payload.test) {
       return new Response(
        JSON.stringify({ message: "Test webhook received successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    // Edge functions can use the service role key to bypass RLS for internal data manip if needed
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase environment variables not found!");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: storeRow, error: storeError } = await supabase
      .from("store_data")
      .select("*")
      .eq("store_id", storeId)
      .single();

    if (storeError || !storeRow) {
      return new Response(
        JSON.stringify({ error: "Store not found", details: storeError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let storeJson = storeRow.data_json || {};
    if (typeof storeJson === "string") {
      try { storeJson = JSON.parse(storeJson); } catch(e) {}
    }

    if (!storeJson.orders) {
      storeJson.orders = [];
    }

    let newOrder: any = null;

    if (platform === "wuilt") {
      const { event, payload: wuiltPayload } = payload;
      
      if (event === "ORDER_PLACED") {
        const orderData = wuiltPayload?.order;
        if (orderData) {
          const id = `wuilt-${orderData._id || Date.now()}`;
          const existingOrder = storeJson.orders.find((o: any) => o.id === id || o.platformOrderId === orderData._id);
          
          if (!existingOrder) {
            newOrder = {
              id,
              orderNumber: `W-${orderData.orderSerial || Date.now()}`,
              date: orderData.createdAt || new Date().toISOString(),
              shippingCompany: orderData.wuiltShipmentProvider || orderData.shippingRateName || "ويلت",
              shippingArea: orderData.shippingAddress?.stateName || "غير محدد",
              customerName: orderData.customer?.name || "عميل ويلت",
              customerPhone: orderData.customer?.phone || orderData.shippingAddress?.phone || "غير متوفر",
              customerPhone2: orderData.shippingAddress?.secondPhone || "",
              customerAddress: `${orderData.shippingAddress?.addressLine1 || ""} ${orderData.shippingAddress?.addressLine2 || ""}`.trim() || "لا يوجد عنوان",
              city: orderData.shippingAddress?.cityName || "",
              governorate: orderData.shippingAddress?.stateName || "",
              notes: orderData.notes || "",
              items: (orderData.items || []).map((item: any) => ({
                productId: item.productId || item._id,
                name: item.title || "منتج",
                quantity: item.quantity || 1,
                price: item.price?.amount || 0,
                cost: item.variantSnapshot?.cost || 0,
                weight: 0,
              })),
              shippingFee: orderData.shippingRateCost?.amount || 0,
              status: "جديد",
              productName: (orderData.items && orderData.items[0]) ? orderData.items[0].title : "طلب عبر ويلت",
              productPrice: orderData.subtotal?.amount || 0,
              productCost: 0,
              weight: orderData.packagingDetails?.weight || 0,
              discount: orderData.receipt?.discount?.amount || 0,
              includeInspectionFee: false,
              isInsured: false,
              paymentStatus: orderData.paymentStatus === "PAID" ? "تم الدفع" : "معلق",
              preparationStatus: "قيد التجهيز",
              platform: "wuilt",
              platformOrderId: orderData._id,
              paymentMethod: orderData.paymentMethod === "CASH_ON_DELIVERY" ? "الدفع عند الاستلام" : orderData.paymentMethod,
            };
          } else {
             console.log(`Order ${id} already exists`);
          }
        }
      }
    } else {
      // Handle Custom Integration / Order placement directly mapping to internal Order Type
      newOrder = {
        ...payload,
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        date: payload.date || new Date().toISOString(),
        orderNumber: payload.orderNumber || `WH-${Date.now()}`,
        platform: "custom_api"
      };
    }

    if (newOrder) {
      storeJson.orders.unshift(newOrder); // Add to top of the list
      
      const { error: updateError } = await supabase
        .from("store_data")
        .update({ data_json: storeJson })
        .eq("store_id", storeId);

      if (updateError) {
         throw updateError;
      }
    }

    return new Response(
      JSON.stringify({ message: "Webhook processed successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
