import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Governorate translation map
const GOVERNORATE_MAP: Record<string, string> = {
    'CAIRO': 'القاهرة',
    'GIZA': 'الجيزة',
    'ALEXANDRIA': 'الإسكندرية',
    'QALYUBIA': 'القليوبية',
    'DAKAHLIA': 'الدقهلية',
    'SHARKIA': 'الشرقية',
    'GHARBIA': 'الغربية',
    'MONUFIA': 'المنوفية',
    'BEHEIRA': 'البحيرة',
    'KAFR EL SHEIKH': 'كفر الشيخ',
    'KAFRELSHEIKH': 'كفر الشيخ',
    'DAMIETTA': 'دمياط',
    'PORT SAID': 'بورسعيد',
    'ISMAILIA': 'الإسماعيلية',
    'SUEZ': 'السويس',
    'BENI SUEF': 'بني سويف',
    'FAYOUM': 'الفيوم',
    'MINYA': 'المنيا',
    'ASSUIT': 'أسيوط',
    'SOhag': 'سوهاج',
    'QENA': 'قنا',
    'LUXOR': 'الأقصر',
    'ASWAN': 'أسوان',
    'RED SEA': 'البحر الأحمر',
    'NEW VALLEY': 'الوادي الجديد',
    'MATROUH': 'مطروح',
    'NORTH SINAI': 'شمال سيناء',
    'SOUTH SINAI': 'جنوب سيناء',
};

// Helper to map Wuilt order data to internal schema
function mapWuiltOrder(order: any, storeId: string, settings?: any) {
    if (!order) return null;

    const id = `wuilt-${order.id}`;
    
    const financial = order.receipt || {};
    const shipmentDetails = order.shipmentDetails || {};
    const totalPrice = financial.total?.amount || financial.total || 0;
    const subtotal = financial.subtotal?.amount || financial.subtotal || 0;
    const discount = financial.discount?.amount || financial.discount || 0;
    const tax = financial.tax?.amount || financial.tax || 0;
    
    // Shipping fee mapping - prioritize receipt shipping as it reflects manual edits by merchant
    const shippingFee = financial.shipping?.amount ?? financial.shipping ?? 
                       order.packagingDetails?.shippingCostDetails?.baseCost ??
                       order.shippingRateCost?.amount ?? order.shippingRateCost ?? 0;

    // Status mapping based on Wuilt fulfillment/shipping status
    let mappedStatus = 'جاري_المراجعة'; 
    
    // Priority 1: Terminal platform flags
    const isActuallyArchived = order.isArchived === true;
    const isActuallyCanceled = order.isCanceled === true || order.fulfillmentStatus === 'CANCELED';

    // Priority 2: Shipment status (more specific for tracking)
    const wuiltShipmentStatus = (shipmentDetails.shippingStatus || order.shippingStatus || '').toUpperCase();
    
    if (isActuallyArchived) {
        mappedStatus = 'مؤرشف';
    } else if (isActuallyCanceled) {
        mappedStatus = 'ملغي';
    } else if (wuiltShipmentStatus) {
        if (wuiltShipmentStatus === 'DELIVERED') {
            mappedStatus = 'تم_توصيلها';
        } else if (wuiltShipmentStatus === 'RETURNED' || wuiltShipmentStatus === 'RTS') {
            mappedStatus = 'مرتجع';
        } else if (wuiltShipmentStatus === 'FAILURE' || wuiltShipmentStatus === 'FAILED') {
            mappedStatus = 'فشل_التوصيل';
        } else if (wuiltShipmentStatus === 'IN_TRANSIT') {
            mappedStatus = 'قيد_الشحن'; 
        } else if (wuiltShipmentStatus === 'SHIPPED') {
            mappedStatus = 'تم_الارسال'; 
        } else if (wuiltShipmentStatus === 'READY_FOR_PICKUP') {
            mappedStatus = 'قيد_التنفيذ'; 
        } else if (wuiltShipmentStatus === 'CREATED' || wuiltShipmentStatus === 'PENDING') {
            mappedStatus = 'في_انتظار_المكالمة'; 
        } else {
            mappedStatus = 'في_انتظار_المكالمة'; 
        }
    } else if (order.fulfillmentStatus === 'FULFILLED') {
        mappedStatus = 'قيد_التنفيذ';
    } else if (order.fulfillmentStatus === 'PARTIALLY_FULFILLED') {
        mappedStatus = 'قيد_التنفيذ';
    } else if (shipmentDetails.airWayBill) {
        mappedStatus = 'قيد_التنفيذ';
    } else if (order.fulfillmentStatus === 'UNFULFILLED' || order.fulfillmentStatus === 'PENDING') {
        mappedStatus = 'في_انتظار_المكالمة';
    } else if (order.status === 'AUTHORIZED') {
        mappedStatus = 'جاري_المراجعة';
    } else {
        mappedStatus = 'في_انتظار_المكالمة';
    }

    const rawGovernorate = (order.shippingAddress?.areaSnapshot?.stateName || order.shippingAddress?.stateName || '').toUpperCase();
    const mappedGovernorate = GOVERNORATE_MAP[rawGovernorate] || order.shippingAddress?.areaSnapshot?.stateName || order.shippingAddress?.stateName || '';

    const waybillNumber = shipmentDetails.airWayBill || shipmentDetails.orderTrackingNumber || '';
    const trackingUrl = shipmentDetails.trackingURL || '';
    const shippingCompany = shipmentDetails.shippedWith || order.wuiltShipmentProvider || 'ويلت';

    const defaultIncludeInspection = settings?.enableInspection ?? true;
    const defaultIsInsured = settings?.enableInsurance ?? true;
    
    // Map payment method
    let mappedPaymentMethod = order.paymentMethod || order.paymentIntent?.paymentProvider || 'غير محدد';
    if (mappedPaymentMethod === 'CASH_ON_DELIVERY' || mappedPaymentMethod === 'cod') {
        mappedPaymentMethod = 'الدفع عند الاستلام';
    } else if (mappedPaymentMethod === 'CREDIT_CARD' || mappedPaymentMethod === 'card') {
         mappedPaymentMethod = 'بطاقة إئتمانية';
    }

    const internalPaymentStatus = (order.paymentStatus === 'PAID' || order.paymentIntent?.status === 'succeeded') ? 'مدفوع' : 'بانتظار الدفع';

    return {
        id,
        store_id: storeId,
        order_number: order.orderSerial ? `W-${order.orderSerial}` : `W-${Date.now()}`,
        customer_name: order.customer?.name || 'عميل ويلت',
        status: mappedStatus,
        date: order.createdAt || new Date().toISOString(),
        total_price: financial.total?.amount ?? financial.total ?? totalPrice,
        details: {
            shippingCompany,
            shippingArea: mappedGovernorate || 'غير محدد',
            waybillNumber,
            trackingUrl,
            customerPhone: order.customer?.phone || order.shippingAddress?.phone || 'غير متوفر',
            customerPhone2: order.shippingAddress?.secondPhone || '',
            customerAddress: (order.shippingAddress?.addressLine1 || order.shippingAddress?.address1 || order.shippingAddress?.addressLine2 || 'لا يوجد عنوان').trim(),
            city: order.shippingAddress?.areaSnapshot?.cityName || order.shippingAddress?.city || order.shippingAddress?.cityName || '',
            governorate: mappedGovernorate,
            notes: order.shippingAddress?.notes || order.notes || '',
            items: (order.items || order.lineItems?.edges?.map((e: any) => e.node) || []).map((item: any) => ({
                productId: `wuilt-${item.productSnapshot?.id || item.variant?.product?.id || item.id || 'unknown'}`,
                name: item.title || 'منتج',
                quantity: item.quantity || 1,
                price: item.variantSnapshot?.price?.amount || item.variantSnapshot?.price || item.productSnapshot?.price?.amount || item.price || 0,
                cost: item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 0,
                weight: item.variantSnapshot?.weight || item.productSnapshot?.weight || 0
            })),
            shippingFee: shippingFee,
            productName: (order.items && order.items[0]) ? order.items[0].title : 'طلب عبر ويلت', 
            productPrice: financial.subtotal?.amount ?? financial.subtotal ?? subtotal,
            productCost: (order.items || []).reduce((total: number, item: any) => {
                const itemCost = item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 0;
                return total + (itemCost * (item.quantity || 1));
            }, 0),
            weight: order.packagingDetails?.extraWeight || 0,
            discount: financial.discount?.amount ?? financial.discount ?? discount,
            tax: financial.tax?.amount ?? financial.tax ?? tax,
            includeInspectionFee: order.packagingDetails?.isOpenShipment ?? order.shipmentDetails?.allowOpen ?? defaultIncludeInspection,
            isInsured: ((order.packagingDetails?.shippingCostDetails?.insurancePercentage || 0) > 0) || order.packagingDetails?.isInsured || defaultIsInsured,
            paymentStatus: internalPaymentStatus,
            preparationStatus: order.fulfillmentStatus === 'FULFILLED' ? 'تم التجهيز' : 'قيد التجهيز',
            platform: 'wuilt',
            platformOrderId: order.id,
            paymentMethod: mappedPaymentMethod,
            buildingDetails: order.shippingAddress?.addressLine2 || '',
            source: 'synced',
            totalPrice: totalPrice
        }
    };
}

// Helper to map Wuilt product data to internal schema
function mapWuiltProduct(product: any, storeId: string) {
    if (!product) return null;
    
    const firstVariant = product.variants?.nodes?.[0] || product.variants?.[0] || {};
    const images = (product.images || []).map((img: any) => img.src);
    
    // Using camelCase keys to match internal schema used in databaseService.ts
    const id = `wuilt-${product.id}`;
    const name = product.title || 'منتج بدون اسم';
    const sku = firstVariant?.sku || `W-${product.id}`;
    const price = firstVariant?.price?.amount || firstVariant?.price || 0;
    const stockQuantity = firstVariant?.trackQuantity ? (firstVariant?.quantity ?? 0) : null;

    return {
        id,
        store_id: storeId,
        name,
        sku,
        price,
        stock_quantity: stockQuantity,
        details: {
            description: product.descriptionHtml || product.shortDescription || '',
            costPrice: firstVariant?.cost?.amount || firstVariant?.cost || 0,
            images: images,
            thumbnail: images[0] || '',
            type: product.type,
            status: product.status,
            handle: product.handle,
            trackQuantity: firstVariant?.trackQuantity ?? false,
            variants: (product.variants?.nodes || product.variants || []).map((v: any) => ({
                id: v.id,
                title: v.title,
                sku: v.sku,
                price: v.price?.amount || v.price || 0,
                cost: v.cost?.amount || v.cost || 0,
                quantity: v.trackQuantity ? (v.quantity ?? 0) : null,
                trackQuantity: v.trackQuantity ?? false
            })),
            options: (product.options || []).map((o: any) => ({
                id: o.id,
                name: o.name,
                values: (o.values || []).map((v: any) => v.name || v)
            }))
        }
    };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://keqmlcqymkohxzcouxfi.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcW1sY3F5bWtvaHh6Y291eGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODU0NzAsImV4cCI6MjA4NjE2MTQ3MH0.OfxqWM9CFCcLj62u5KLWZyiiBhUH-miUu882Cqlwf4I';
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Unified internal handler for syncing a platform's data
  async function handleUniversalSyncInternal(supabase: any, storeId: string, platformId: string, type: 'orders' | 'products', selectedIds: string[] | null, settings: any) {
    const config = settings.platformConfigs?.[platformId];
    if (!config || !config.apiKey) throw new Error(`${platformId} API key not configured.`);
    
    let itemsToProcess = [];
    
    if (platformId === 'wuilt') {
      const apiKey = config.apiKey.trim();
      const wuiltStoreId = config.shopId?.trim() || config.storeId?.trim();
      const authHeader = apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
      
      const query = type === 'products' ? `
        query ListStoreProducts($connection: ProductsConnectionInput, $filter: ProductsFilterInput) {
          products(connection: $connection, filter: $filter) {
            nodes {
              id title handle type status source isVisible isArchived descriptionHtml shortDescription
              images { src }
              variants(first: 50) { nodes { id title sku price { amount } cost { amount } quantity trackQuantity } }
              options { id name values { name } }
            }
          }
        }
      ` : `
        query ListStoreOrders($storeId: ID!, $connection: OrdersConnectionInput) {
          orders(storeId: $storeId, connection: $connection) {
            nodes {
              id isArchived isCanceled fulfillmentStatus paymentStatus orderSerial shippingStatus
              wuiltShipmentProvider createdAt notes
              customer { name phone }
              shippingAddress { phone secondPhone addressLine1 addressLine2 notes areaSnapshot { stateName cityName } }
              shippingRateCost { amount }
              receipt { subtotal { amount } discount { amount } tax { amount } shipping { amount } total { amount } }
              shipmentDetails { airWayBill orderTrackingNumber trackingURL shippedWith shippingStatus allowOpen }
              packagingDetails { weight isOpenShipment isInsured shippingCostDetails { baseCost insurancePercentage } }
              items { id title quantity price { amount } variantSnapshot { price { amount } cost { amount } weight } productSnapshot { id price { amount } cost { amount } weight } }
              lineItems(first: 50) { edges { node { id title quantity price { amount } variantSnapshot { price { amount } cost { amount } weight } productSnapshot { id price { amount } cost { amount } weight } } } }
            }
          }
        }
      `;

      const variables = type === 'products' ? {
        connection: { first: 100, sortBy: "createdAt", sortOrder: "desc" },
        filter: { storeIds: [wuiltStoreId] }
      } : {
        storeId: wuiltStoreId,
        connection: { first: 100, sortBy: "createdAt", sortOrder: "desc" }
      };

      const response = await fetch('https://graphql.wuilt.com', {
        method: 'POST',
        headers: { 
          'Authorization': authHeader, 
          'X-API-KEY': apiKey, 
          'X-Wuilt-Store-Id': wuiltStoreId, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ query, variables })
      });

      const result: any = await response.json();
      if (!response.ok || result.errors) {
        throw new Error(result.errors?.[0]?.message || `Wuilt API Error: Status ${response.status}`);
      }

      itemsToProcess = type === 'products' ? (result.data?.products?.nodes || []) : (result.data?.orders?.nodes || []);
    }

    if (selectedIds && selectedIds.length > 0) {
      const idSet = new Set(selectedIds);
      itemsToProcess = itemsToProcess.filter((item: any) => idSet.has(item.id));
    }

    const table = type === 'products' ? 'products' : 'orders';
    const mapper = type === 'products' ? mapWuiltProduct : (item: any, id: string) => mapWuiltOrder(item, id, settings);
    const mappedItems = itemsToProcess.map(item => mapper(item, storeId)).filter(Boolean);

    if (mappedItems.length === 0) return { inserted: 0, updated: 0, processed: 0, skipped: 0, status: "success" };

    const { data: existingIds } = await supabase.from(table).select('id').in('id', mappedItems.map(o => o.id));
    const existingSet = new Set(existingIds?.map(i => i.id) || []);

    const newItems = mappedItems.filter(o => !existingSet.has(o.id));
    const updateItems = mappedItems.filter(o => existingSet.has(o.id));

    if (newItems.length > 0) {
      const { error: insertError } = await supabase.from(table).insert(newItems);
      if (insertError) throw insertError;
    }

    if (updateItems.length > 0) {
      if (table === 'orders') {
         const { data: locals } = await supabase.from('orders').select('id, status').in('id', updateItems.map(o => o.id));
         const localStatusMap = (locals || []).reduce((acc: any, cur: any) => ({...acc, [cur.id]: cur.status}), {});
         
         const safeUpdateItems = updateItems.map((item: any) => {
            const localStatus = localStatusMap[item.id];
            if (item.status === 'في_انتظار_المكالمة' && localStatus && localStatus !== 'في_انتظار_المكالمة') {
               const { status, ...rest } = item;
               return rest;
            }
            return item;
         });

         const { error: updateError } = await supabase.from(table).upsert(safeUpdateItems);
         if (updateError) throw updateError;
      } else {
         const { error: updateError } = await supabase.from(table).upsert(updateItems);
         if (updateError) throw updateError;
      }
    }

    return { 
      inserted: newItems.length, 
      updated: updateItems.length, 
      processed: mappedItems.length,
      skipped: mappedItems.length - (newItems.length + updateItems.length),
      status: "success"
    };
  }

  // API to update status in Wuilt
  async function updateWuiltPayload(apiKey: string, storeId: string, platformOrderId: string, status: string) {
    const authHeader = apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
    let wuiltStatus = undefined;
    let wuiltShippingStatus = undefined;

    if (status === 'ملغي') wuiltStatus = 'CANCELLED';
    if (status === 'تم_توصيلها' || status === 'تم_التحصيل') wuiltShippingStatus = 'DELIVERED';
    if (status === 'تم_الارسال') wuiltShippingStatus = 'SHIPPED';
    if (status === 'قيد_الشحن') wuiltShippingStatus = 'IN_TRANSIT';
    if (status === 'مرتجع') wuiltShippingStatus = 'RETURNED';

    if (!wuiltStatus && !wuiltShippingStatus) return;

    const query = `
      mutation UpdateOrderStatus($orderId: ID!, $input: UpdateOrderInput!) {
        updateOrder(id: $orderId, input: $input) {
          order { id status shippingStatus }
        }
      }
    `;

    const variables = {
      orderId: platformOrderId,
      input: {
        ...(wuiltStatus && { status: wuiltStatus }),
        ...(wuiltShippingStatus && { shippingStatus: wuiltShippingStatus })
      }
    };

    try {
      await fetch('https://graphql.wuilt.com', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'X-API-KEY': apiKey, 'X-Wuilt-Store-Id': storeId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });
    } catch (e) { console.error("Wuilt Update Error:", e); }
  }

  // API: Push Status to Platform
  app.post("/api/platforms/push-status/:storeId/:orderId", async (req, res) => {
    const { storeId, orderId } = req.params;
    const { status } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });

    try {
      const { data: storeRow } = await supabase.from('stores_data').select('settings').eq('id', storeId).single();
      if (!storeRow) return res.status(404).json({ error: "Store not found" });

      if (orderId.startsWith('wuilt-')) {
        const platformOrderId = orderId.replace('wuilt-', '');
        const config = storeRow.settings?.platformConfigs?.wuilt;
        if (config?.apiKey && (config?.shopId || config?.storeId)) {
          await updateWuiltPayload(config.apiKey, config.shopId || config.storeId, platformOrderId, status);
          return res.json({ success: true, message: "Pushed to Wuilt" });
        }
      }
      res.json({ success: false, message: "No integration found" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // API: Sync All Connected Platforms
  app.post("/api/sync/all/:storeId", async (req, res) => {
    const { storeId } = req.params;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data: storeRow } = await supabase.from('stores_data').select('settings').eq('id', storeId).single();
      if (!storeRow) return res.status(404).json({ error: "Store not found" });
      const settings = storeRow.settings || {};
      const connectedPlatforms = settings.connectedPlatforms || [];
      const results = [];
      for (const p of connectedPlatforms) {
        try {
          const resFull = await handleUniversalSyncInternal(supabase, storeId, p, 'orders', null, settings);
          results.push({ platform: p, ...resFull });
        } catch (e: any) { results.push({ platform: p, error: e.message }); }
      }
      res.json({ success: true, results });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // API: Sync Specific Platform
  app.post("/api/sync/platform/:platform/:storeId", async (req, res) => {
    const { platform, storeId } = req.params;
    const { type = 'orders' as any } = req.query;
    const { selectedIds } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data: storeRow } = await supabase.from('stores_data').select('settings').eq('id', storeId).single();
      const resVal = await handleUniversalSyncInternal(supabase, storeId, platform, type, selectedIds, storeRow?.settings || {});
      res.json({ success: true, ...resVal });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // API: Webhook Handler
  app.post("/api/webhook/platform/:platform/:storeId", async (req, res) => {
    const { platform, storeId } = req.params;
    const payload = req.body;
    res.status(200).send("OK");
    if (payload.test) return;

    setImmediate(async () => {
      try {
        const { data: storeRow } = await supabase.from('stores_data').select('settings').eq('id', storeId).single();
        if (!storeRow) return;
        let newOrder = null;
        if (platform === 'wuilt') {
          const { event, payload: wuiltPayload } = payload;
          if (['ORDER_PLACED', 'ORDER_FULFILLED', 'ORDER_UPDATED'].includes(event)) {
             newOrder = mapWuiltOrder(wuiltPayload.order, storeId, storeRow.settings);
          }
        }
        if (newOrder) await supabase.from('orders').upsert([newOrder]);
      } catch (e) { console.error("Webhook Error:", e); }
    });
  });

  // Serve app
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
