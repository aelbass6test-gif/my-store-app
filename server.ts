import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import fs from "fs";

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

// Recursively traverse and clean up any undefined properties for Firestore safety
function cleanUndefined(obj: any): any {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item));
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val !== undefined) {
                result[key] = cleanUndefined(val);
            }
        }
        return result;
    }
    return obj;
}

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
                       shipmentDetails.shippingFee?.amount ?? shipmentDetails.shippingFee ?? 
                       order.packagingDetails?.shippingCostDetails?.baseCost ??
                       order.shippingRateCost?.amount ?? order.shippingRateCost ?? 0;

    // Status mapping based on Wuilt fulfillment/shipping status
    let mappedStatus = 'جاري_المراجعة'; 
    
    // Priority 1: Terminal platform flags
    const isActuallyArchived = order.isArchived === true;
    const isActuallyCanceled = order.isCanceled === true || order.fulfillmentStatus === 'CANCELED';
    const isActuallyReturned = order.fulfillmentStatus === 'RETURNED' || order.fulfillmentStatus === 'RESTOCKED';
    const isActuallyHold = order.fulfillmentStatus === 'HOLD' || order.fulfillmentStatus === 'ON_HOLD' || order.tags?.some((t:any) => t.name?.toLowerCase() === 'hold' || t.name === 'مؤجل' || t.name === 'هولد');
    const isActuallyScheduled = order.fulfillmentStatus === 'SCHEDULED' || order.tags?.some((t:any) => t.name?.toLowerCase() === 'scheduled' || t.name === 'مجدول');

    // Priority 2: Shipment status (more specific for tracking)
    const wuiltShipmentStatus = shipmentDetails.shippingStatus || order.shippingStatus;
    
    if (isActuallyArchived) {
        mappedStatus = 'مؤرشف';
    } else if (isActuallyCanceled) {
        mappedStatus = 'ملغي';
    } else if (isActuallyReturned) {
        mappedStatus = 'تمت_الاعادة_لشركة_الشحن';
    } else if (isActuallyHold) {
        mappedStatus = 'مؤجل';
    } else if (isActuallyScheduled) {
        mappedStatus = 'مجدول';
    } else if (wuiltShipmentStatus) {
        const ss = wuiltShipmentStatus.toUpperCase();
        if (ss === 'DELIVERED') {
            mappedStatus = (order.paymentStatus === 'PAID' || order.paymentIntent?.status === 'succeeded') ? 'مدفوعة' : 'تم_توصيلها';
        } else if (ss === 'RETURNED' || ss === 'RTS' || ss === 'RETURNED_TO_SHIPPING_COMPANY' || ss.includes('RETURNED_TO_') || ss.includes('RETURN_TO_') || ss === 'RTO') {
            mappedStatus = 'تمت_الاعادة_لشركة_الشحن';
        } else if (ss === 'FAILURE' || ss === 'FAILED') {
            mappedStatus = 'فشل_التوصيل';
        } else if (ss === 'IN_TRANSIT') {
            mappedStatus = 'قيد_الشحن'; 
        } else if (ss === 'SHIPPED') {
            mappedStatus = 'تم_الارسال'; 
        } else if (ss === 'READY_FOR_PICKUP') {
            mappedStatus = 'قيد_التنفيذ'; // جاهز وفي انتظار المندوب
        } else if (ss === 'HOLD' || ss === 'ON_HOLD') {
            mappedStatus = 'مؤجل';
        } else if (ss === 'SCHEDULED') {
            mappedStatus = 'مجدول';
        } else if (ss === 'CREATED' || ss === 'PENDING') {
            mappedStatus = 'في_انتظار_المكالمة'; // بانتظار البوليصة
        } else {
            mappedStatus = 'في_انتظار_المكالمة'; // Fallback for unknown creation states
        }
    } else if (order.fulfillmentStatus === 'FULFILLED') {
        mappedStatus = 'قيد_التنفيذ'; // جاهز
    } else if (order.fulfillmentStatus === 'PARTIALLY_FULFILLED') {
        mappedStatus = 'قيد_التنفيذ'; // شبه جاهز
    } else if (shipmentDetails.airWayBill) {
        mappedStatus = 'قيد_التنفيذ'; // تم إنشاء بوليصة
    } else if (order.fulfillmentStatus === 'UNFULFILLED' || order.fulfillmentStatus === 'PENDING') {
        mappedStatus = 'في_انتظار_المكالمة';
    } else {
        mappedStatus = 'في_انتظار_المكالمة'; // Fallback for new orders
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

    const includeInspectionFee = order.packagingDetails?.isOpenShipment ?? order.shipmentDetails?.allowOpen ?? order.tags?.some((t:any) => t.name === 'open_shipment' || t.name === 'inspection') === true ? true : defaultIncludeInspection;
    const isInsured = ((order.packagingDetails?.shippingCostDetails?.insurancePercentage || 0) > 0) || order.packagingDetails?.isInsured || order.shipmentDetails?.hasInsurance || order.tags?.some((t:any) => t.name === 'insured') === true ? true : defaultIsInsured;
    const mappedSubtotal = financial.subtotal?.amount ?? financial.subtotal ?? subtotal;
    const lineItems = (order as any).lineItems?.edges?.map((e: any) => e.node) || (order as any).lineItems || [];

    return {
        id,
        storeId: storeId,
        store_id: storeId,
        order_number: order.orderSerial ? `W-${order.orderSerial}` : `W-${Date.now()}`,
        customer_name: order.customer?.name || 'عميل ويلت',
        status: mappedStatus,
        date: order.createdAt || new Date().toISOString(),
        total_price: financial.total?.amount ?? financial.total ?? totalPrice,
        product_cost: (order.items || []).reduce((total: number, item: any, idx: number) => {
            const lineItem = lineItems[idx] || {};
            const itemCost = item.cost?.amount ?? item.cost ??
                           item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? 
                           item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 
                           lineItem.variant?.cost?.amount ?? lineItem.variant?.cost ?? 0;
            return total + (itemCost * (item.quantity || 1));
        }, 0),
        details: {
            shippingCompany,
            shippingArea: mappedGovernorate || 'غير محدد',
            waybillNumber,
            trackingUrl,
            customerPhone: order.customer?.name ? (order.customer?.phone || order.shippingAddress?.phone) : (order.shippingAddress?.phone || 'غير متوفر'),
            customerPhone2: order.shippingAddress?.secondPhone || '',
            customerAddress: order.shippingAddress?.addressLine1 || order.shippingAddress?.addressLine2 || 'لا يوجد عنوان',
            city: order.shippingAddress?.areaSnapshot?.cityName || order.shippingAddress?.cityName || '',
            governorate: mappedGovernorate,
            notes: order.shippingAddress?.notes || '',
            items: (order.items || []).map((item: any, idx: number) => {
                const lineItem = lineItems[idx] || {};
                const itemCost = item.cost?.amount ?? item.cost ??
                               item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? 
                               item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 
                               lineItem.variant?.cost?.amount ?? lineItem.variant?.cost ?? 0;
                return {
                    productId: `wuilt-${item.productSnapshot?.id || item.id}`,
                    name: item.title || 'منتج',
                    quantity: item.quantity || 1,
                    price: item.price?.amount || item.price || item.variantSnapshot?.price?.amount || item.variantSnapshot?.price || item.productSnapshot?.price?.amount || 0,
                    cost: itemCost,
                    weight: item.variantSnapshot?.weight || item.productSnapshot?.weight || 0
                };
            }),
            shippingFee: shippingFee,
            productName: (order.items && order.items[0]) ? order.items[0].title : 'طلب عبر ويلت', 
            productPrice: financial.subtotal?.amount ?? financial.subtotal ?? subtotal,
            productCost: (order.items || []).reduce((total: number, item: any, idx: number) => {
                const lineItem = lineItems[idx] || {};
                const itemCost = item.cost?.amount ?? item.cost ??
                               item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? 
                               item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 
                               lineItem.variant?.cost?.amount ?? lineItem.variant?.cost ?? 0;
                return total + (itemCost * (item.quantity || 1));
            }, 0),
            weight: order.packagingDetails?.extraWeight || 0,
            discount: financial.discount?.amount ?? financial.discount ?? discount,
            tax: financial.tax?.amount ?? financial.tax ?? tax,
            includeInspectionFee: includeInspectionFee,
            isInsured: isInsured,
            insuranceFee: isInsured ? (mappedSubtotal + shippingFee) * 0.01 : 0,
            inspectionFee: includeInspectionFee ? (settings?.inspectionFee ?? 0) : 0,
            paymentStatus: (order.paymentStatus === 'PAID' || order.paymentIntent?.status === 'succeeded') ? 'تم الدفع' : 'معلق',
            preparationStatus: order.fulfillmentStatus === 'FULFILLED' ? 'تم التجهيز' : 'قيد التجهيز',
            platform: 'wuilt',
            platformOrderId: order.id,
            paymentMethod: mappedPaymentMethod,
            buildingDetails: `${order.shippingAddress?.building || ''} ${order.shippingAddress?.floor ? `دور ${order.shippingAddress.floor}` : ''} ${order.shippingAddress?.apartment ? `شقة ${order.shippingAddress.apartment}` : ''}`.trim() || order.shippingAddress?.addressLine2 || '',
            source: 'synced'
        }
    };
}

// Helper to map Wuilt product data to internal schema
function mapWuiltProduct(product: any, storeId: string) {
    if (!product) return null;
    
    const firstVariant = product.variants?.nodes?.[0] || {};
    const images = (product.images || []).map((img: any) => img.src);
    
    const hasVariants = (product.variants?.nodes?.length || 0) > 1;
    const mappedVariants = (product.variants?.nodes || []).map((v: any) => {
        const variantOptions: { [key: string]: string } = {};
        if (v.selectedOptions) {
            v.selectedOptions.forEach((so: any) => {
                if (so.option?.name && so.value?.name) {
                    variantOptions[so.option.name] = so.value.name;
                }
            });
        }
        return {
            id: v.id,
            sku: v.sku || `W-V-${v.id}`,
            price: Number(v.price?.amount || 0),
            costPrice: Number(v.cost?.amount || 0),
            stockQuantity: v.trackQuantity ? (v.quantity ?? 0) : null,
            options: variantOptions
        };
    });

    const mappedOptions = (product.options || []).map((o: any) => o.name);

    return {
        id: `wuilt-${product.id}`,
        storeId: storeId,
        store_id: storeId,
        name: product.title || 'منتج بدون اسم',
        sku: firstVariant?.sku || `W-${product.id}`,
        price: Number(firstVariant?.price?.amount || 0),
        weight: Number(product.weight || 1),
        costPrice: Number(firstVariant?.cost?.amount || 0),
        thumbnail: images[0] || '',
        images: images,
        description: product.descriptionHtml || product.shortDescription || '',
        stockQuantity: firstVariant?.trackQuantity ? (firstVariant?.quantity ?? 0) : null,
        hasVariants: hasVariants,
        options: mappedOptions,
        variants: mappedVariants
    };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  let firebaseConfig = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.warn("Could not load firebase-applet-config.json on server:", err);
  }

  const firebaseApp = initializeApp(firebaseConfig);
  const db = (firebaseConfig as any).firestoreDatabaseId 
    ? getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId)
    : getFirestore(firebaseApp);

  // OTP Verification API for Firebase
  app.post("/api/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    console.log(`[OTP] Verifying OTP for ${email}: ${otp}`);
    if (otp && /^\d{6}$/.test(otp)) {
      return res.json({ valid: true });
    }
    return res.status(400).json({ valid: false, message: "رمز التحقق غير صحيح. يرجى إدخال أي 6 أرقام مثل 123456 للتبسيط." });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Temporary Introspection
  app.get("/api/introspect", async (req, res) => {
    try {
        const query = `
          query IntrospectionQuery {
            __schema {
              mutationType { name }
              types {
                name
                fields {
                  name args { name type { name kind ofType { name kind } } }
                }
              }
            }
          }
        `;
        const response = await fetch('https://graphql.wuilt.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await response.json();
        if (json.data && json.data.__schema && json.data.__schema.mutationType) {
            const mutationTypeName = json.data.__schema.mutationType.name;
            const mutationType = json.data.__schema.types.find((t: any) => t.name === mutationTypeName);
            const orderMutations = mutationType.fields.filter((f: any) => f.name.toLowerCase().includes('order') || f.name.toLowerCase().includes('fulfill') || f.name.toLowerCase().includes('ship'));
            res.json(orderMutations.map((m: any) => ({ name: m.name, args: m.args.map((a: any) => a.name) })));
        } else {
            res.json(json);
        }
    } catch (e: any) {
        res.json({ error: e.message });
    }
  });

  // Webhook Listener
  app.post("/api/webhook/platform/:platform/:storeId", async (req, res) => {
    const { platform, storeId } = req.params;
    const payload = req.body;

    console.log(`[WEBHOOK] Received from ${platform} for Store ID: ${storeId}`);

    try {
        // 1. Fetch Store Settings
        const storeSnap = await getDoc(doc(db, 'stores_data', storeId));
        if (!storeSnap.exists()) {
            console.error(`[WEBHOOK] Store ${storeId} not found`);
            return res.status(404).json({ error: "Store not found" });
        }

        const storeRow = storeSnap.data();
        const settings = storeRow.settings || {};

        // 2. Process Payload
        if (platform === 'wuilt') {
            const { event, payload: wuiltPayload } = payload;
            
            // Log everything for debugging
            console.log(`[WEBHOOK] Received event: ${event}`, JSON.stringify(wuiltPayload));
            
            if ((event === "ORDER_PLACED" || event === "ORDER_UPDATED") && wuiltPayload?.order ) {
                const orderData = wuiltPayload.order;
                const mappedOrder = mapWuiltOrder(orderData, storeId, settings);
                
                if (mappedOrder) {
                    // Check for existing order
                    const orderSnap = await getDoc(doc(db, 'orders', mappedOrder.id));
                    const existing = orderSnap.exists() ? orderSnap.data() : null;

                    if (!existing) {
                        await setDoc(doc(db, 'orders', mappedOrder.id), cleanUndefined(mappedOrder), { merge: true });
                        console.log(`[WEBHOOK] Order ${mappedOrder.id} inserted successfully`);
                    } else {
                        // User Request: Synced orders should always take the status from the platform (Wuilt)
                        // EXCEPTION: Protected statuses that are likely manual overrides locally
                        const preserveStatuses = ['تم_التحصيل', 'مدفوعة', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مؤرشف', 'تم_الاستبدال'];
                        if (existing.status && preserveStatuses.includes(existing.status)) {
                             mappedOrder.status = existing.status;
                        } else if (mappedOrder.status === 'في_انتظار_المكالمة' && existing.status && existing.status !== 'في_انتظار_المكالمة') {
                             mappedOrder.status = existing.status;
                        }

                        // Update existing order with new status/data
                        await setDoc(doc(db, 'orders', mappedOrder.id), cleanUndefined(mappedOrder), { merge: true });
                        console.log(`[WEBHOOK] Order ${mappedOrder.id} updated successfully`);
                    }
                }
            } else {
                console.log(`[WEBHOOK] Event ${event} was not processed (not ORDER_PLACED or ORDER_UPDATED)`);
            }
        } else {
             console.log(`[WEBHOOK] Platform ${platform} not supported`);
             return res.status(400).json({ error: "Platform not supported" });
        }

        return res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error: any) {
        console.error("[WEBHOOK] Processing error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  // API Sync Preview Endpoint (Fetches data without saving)
  app.get("/api/sync/platform/:platform/:storeId/preview", async (req, res) => {
    const { platform, storeId } = req.params;
    const { type = 'products' } = req.query; // Default to products for preview
    
    try {
        const storeSnap = await getDoc(doc(db, 'stores_data', storeId));
        if (!storeSnap.exists()) return res.status(404).json({ error: "Store not found" });
        const storeRow = storeSnap.data();
        const config = storeRow.settings?.platformConfigs?.[platform];
        if (!config || !config.apiKey) return res.status(400).json({ error: "API Key not configured" });

        let rawItems = [];
        if (platform === 'wuilt') {
            const rawStoreId = (config.shopId || config.shopUrl || '').trim();
            const apiKey = (config.apiKey || '').trim();
            let wuiltStoreId = rawStoreId;
            if (rawStoreId.includes('/store/')) {
                const parts = rawStoreId.split('/store/');
                if (parts[1]) wuiltStoreId = parts[1].split('/')[0];
            }

            const graphqlQuery = type === 'products' ? {
                query: `
                    query ListStoreProducts($connection: ProductsConnectionInput, $filter: ProductsFilterInput, $locale: String) {
                      products(connection: $connection, filter: $filter, locale: $locale) {
                        nodes {
                          id title handle type status locale shortDescription descriptionHtml createdAt updatedAt
                          images { id src altText width height }
                          variants(first: 50) {
                            nodes {
                              id title sku quantity trackQuantity createdAt updatedAt
                              price { amount currencyCode }
                              cost { amount currencyCode }
                            }
                          }
                        }
                      }
                    }
                `,
                variables: {
                    connection: { first: 100, offset: 0, sortBy: "createdAt", sortOrder: "desc" },
                    filter: { storeIds: [wuiltStoreId] },
                    locale: "ar"
                }
            } : null;

            if (!graphqlQuery) return res.status(400).json({ error: "Preview only supported for products" });

            const authHeader = apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
            const response = await fetch('https://graphql.wuilt.com', {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'X-API-KEY': apiKey,
                    'X-Wuilt-Store-Id': wuiltStoreId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(graphqlQuery)
            });

            const result: any = await response.json();
            if (!response.ok || result.errors) {
                return res.status(response.status || 400).json({ error: result.errors?.[0]?.message || "API Error" });
            }
            rawItems = result.data?.products?.nodes || result.data?.products?.edges?.map((e: any) => e.node) || [];
        }

        const mapper = type === 'products' ? mapWuiltProduct : (item: any) => item;
        const mappedItems = rawItems.map(item => mapper(item, storeId)).filter(Boolean);
        
        res.json({ success: true, items: mappedItems });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
  });

  // API Push Order Status to External Platform
  app.post("/api/sync/platform/:platform/:storeId/push-status", async (req, res) => {
    const { platform, storeId } = req.params;
    const { orderId, newStatus, trackingNumber, shippingCompany } = req.body || {};
    
    try {
        // 1. Fetch Store Config
        const storeSnap = await getDoc(doc(db, 'stores_data', storeId));
        if (!storeSnap.exists()) return res.status(404).json({ error: "Store not found" });
        const storeRow = storeSnap.data();

        const config = storeRow.settings?.platformConfigs?.[platform];
        if (!config || !config.apiKey) return res.status(400).json({ error: "API Key not configured" });

        if (platform === 'wuilt') {
            const rawStoreId = (config.shopId || config.shopUrl || '').trim();
            const apiKey = (config.apiKey || '').trim();
            let wuiltStoreId = rawStoreId;
            if (rawStoreId.includes('/store/')) {
                const parts = rawStoreId.split('/store/');
                if (parts[1]) wuiltStoreId = parts[1].split('/')[0];
            }

            const authHeader = apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;

            // Map our internal status back to Wuilt expected statuses
            // Note: Since we don't have the exact Wuilt GraphQL mutation docs,
            // this is a placeholder/mock of where the GraphQL Mutation goes.
            // Typical eCommerce platforms use mutations like `orderFulfill` or `updateOrderStatus`.
            
            // let mappedWuiltStatus = 'PENDING';
            // if (newStatus === 'تم_الشحن' || newStatus === 'تم_الارسال') mappedWuiltStatus = 'SHIPPED';
            // else if (newStatus === 'تم_توصيلها') mappedWuiltStatus = 'DELIVERED';
            // else if (newStatus === 'ملغي') mappedWuiltStatus = 'CANCELED';

            const graphqlMutation = {
                query: `
                  # =========================================================================
                  # TODO: REPLACE WITH EXACT WUILT MUTATION ONCE DOCUMENTATION IS PROVIDED
                  # =========================================================================
                  mutation UpdateWuiltOrder($storeId: ID!, $orderId: ID!, $status: String!) {
                      # orderUpdate(input: { storeId: $storeId, id: $orderId, fulfillmentStatus: $status }) {
                      #   order { id fulfillmentStatus }
                      #   userErrors { message }
                      # }
                      __typename
                  }
                `,
                variables: {
                    storeId: wuiltStoreId,
                    orderId: orderId.replace('wuilt-', ''), // Remove our prefix
                    status: newStatus
                }
            };
            
            // Uncomment the fetch block once the correct mutation is available.
            /*
            const response = await fetch('https://graphql.wuilt.com', {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'X-API-KEY': apiKey,
                    'X-Wuilt-Store-Id': wuiltStoreId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(graphqlMutation)
            });

            const result = await response.json();
            if (!response.ok || result.errors) {
                return res.status(response.status || 400).json({ error: result.errors?.[0]?.message || "API Error" });
            }
            */

            console.log(`[SYNC-PUSH] Mocked push to Wuilt: Order ${orderId} -> ${newStatus}`);
            return res.json({ success: true, message: "تم تسجيل التحديث. بانتظار تفعيل كود المزامنة الخاص بويلت." });
        }

        return res.status(400).json({ error: "Platform not supported for push" });
    } catch (error: any) {
        console.error("[SYNC-PUSH] Error:", error);
        return res.status(500).json({ error: error.message });
    }
  });

  // API Sync All Connected Platforms for a Store
  app.post("/api/sync/all/:storeId", async (req, res) => {
      const { storeId } = req.params;

      try {
          const storeSnap = await getDoc(doc(db, 'stores_data', storeId));
          if (!storeSnap.exists()) return res.status(404).json({ error: "Store not found" });
          const storeRow = storeSnap.data();

          const settings = storeRow.settings || {};
          const connectedPlatforms = settings.connectedPlatforms || [];
          const results: any[] = [];

          for (const platformId of connectedPlatforms) {
              const config = settings.platformConfigs?.[platformId];
              if (config && config.isActive) {
                  // Reuse the sync logic
                  if (platformId === 'wuilt') {
                     try {
                        const wuiltOrders = await fetchWuiltOrders(config.apiKey, config.shopId);
                        const { insertedCount, updatedCount } = await syncOrdersToSupabase(platformId, storeId, wuiltOrders, db);
                        results.push({ platform: platformId, inserted: insertedCount, updated: updatedCount });
                     } catch (err: any) {
                        results.push({ platform: platformId, error: err.message });
                     }
                  }
              }
          }
          return res.json({ success: true, results });
      } catch (error: any) {
          return res.status(500).json({ error: error.message });
      }
  });

  // Helper function to fetch Wuilt orders
  async function fetchWuiltOrders(apiKey: string, storeId: string) {
      const query = `
        query {
          orders(first: 100, sort: { field: CREATED_AT, direction: DESC }) {
            edges {
              node {
                id
                orderNumber
                status
                shippingStatus
                fulfillmentStatus
                shippingRateName
                wuiltShipmentProvider
                tags {
                  name
                }
                totalPrice
                currency
                createdAt
                receipt {
                  shipping {
                    amount
                  }
                  total {
                    amount
                  }
                }
                packagingDetails {
                  shippingCostDetails {
                    baseCost
                    returnCost
                  }
                }
                customer {
                  firstName
                  lastName
                  email
                  phone
                }
                shippingAddress {
                  firstName
                  lastName
                  address1
                  city
                  province
                  phone
                }
                lineItems {
                  edges {
                    node {
                      title
                      quantity
                      variant {
                        price
                        sku
                        cost {
                          amount
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch("https://api.wuilt.com/graphql", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "X-API-KEY": apiKey,
              "X-Wuilt-Store-Id": storeId
          },
          body: JSON.stringify({ query })
      });

      const result = await response.json();
      if (!response.ok || result.errors) {
          throw new Error(result.errors?.[0]?.message || "Wuilt API Error");
      }
      return result.data.orders.edges.map((edge: any) => edge.node);
  }

  // Helper function to sync orders
  async function syncOrdersToSupabase(platform: string, storeId: string, orders: any[], db: any) {
      const q = query(
          collection(db, 'orders'),
          where('store_id', '==', storeId),
          where('platform', '==', platform)
      );
      const querySnap = await getDocs(q);
      const existingOrders = querySnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
      })) as any[];

      const existingMap = new Map();
      existingOrders?.forEach(o => {
          existingMap.set(o.platformOrderId, o);
      });

      const newOrders: any[] = [];
      const changedOrders: any[] = [];

      for (const order of orders) {
          const internalStatus = mapPlatformStatus(order.status, order.shippingStatus, order.fulfillmentStatus, order.tags);
          const internalPaymentStatus = (order.status === 'PAID' || order.paymentStatus === 'PAID') ? 'مدفوع' : 'بانتظار الدفع';
          
          const existing = existingMap.get(order.id);
          
          if (!existing) {
              const items = order.lineItems.edges.map((edge: any) => ({
                  name: edge.node.title,
                  quantity: edge.node.quantity,
                  price: edge.node.variant?.price || 0,
                  cost: typeof edge.node.variant?.cost === 'object' ? edge.node.variant?.cost?.amount : (edge.node.variant?.cost || 0)
              }));

              const baseShippingCost = order.packagingDetails?.shippingCostDetails?.baseCost || order.receipt?.shipping?.amount || 0;
              const insuranceFee = 0.01 * (order.totalPrice || 0);
              const inspectionFee = 0; // Default or extract if found

              const customerPaidShipping = order.receipt?.shipping?.amount || 0;
              const productPrice = (order.totalPrice || 0) - customerPaidShipping;

              newOrders.push({
                  storeId: storeId,
                  store_id: storeId,
                  platform: platform,
                  platformOrderId: order.id,
                  order_number: String(order.orderNumber),
                  customer_name: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || order.shippingAddress?.firstName || 'عميل خارجي',
                  status: internalStatus,
                  date: order.createdAt,
                  total_price: order.totalPrice,
                  details: {
                      customerPhone: order.customer?.phone || order.shippingAddress?.phone || 'غير متوفر',
                      customerAddress: order.shippingAddress?.address1 || 'غير متوفر',
                      shippingArea: order.shippingAddress?.province || 'غير محدد',
                      city: order.shippingAddress?.city || 'غير محدد',
                      items: items,
                      source: 'synced',
                      productName: items.map((i: any) => i.name).join(', '),
                      productPrice: productPrice,
                      productCost: items.reduce((total: number, item: any) => total + ((item.cost || 0) * (item.quantity || 1)), 0),
                      shippingFee: baseShippingCost,
                      insuranceFee: insuranceFee,
                      inspectionFee: inspectionFee,
                      shippingCompany: order.wuiltShipmentProvider || order.shippingRateName || 'غير محدد',
                      paymentStatus: internalPaymentStatus
                  },
                  product_cost: items.reduce((total: number, item: any) => total + ((item.cost || 0) * (item.quantity || 1)), 0)
              });
          } else if (existing.status !== internalStatus || existing.paymentStatus !== internalPaymentStatus) {
              changedOrders.push({
                  id: existing.id,
                  status: internalStatus,
                  paymentStatus: internalPaymentStatus
              });
          }
      }

      let insertedCount = 0;
      let updatedCount = 0;

      if (newOrders.length > 0) {
          for (const order of newOrders) {
              const orderId = order.id || `${platform}-${order.platformOrderId}`;
              await setDoc(doc(db, 'orders', orderId), cleanUndefined({ id: orderId, ...order }), { merge: true });
          }
          insertedCount = newOrders.length;
      }

      if (changedOrders.length > 0) {
          for (const order of changedOrders) {
              await updateDoc(doc(db, 'orders', order.id), cleanUndefined({
                  status: order.status,
                  paymentStatus: order.paymentStatus
              }));
          }
          updatedCount = changedOrders.length;
      }

      return { insertedCount, updatedCount };
  }

  function mapPlatformStatus(status: string, shippingStatus: string, fulfillmentStatus?: string, tags?: any[]): string {
      if (status === 'CANCELLED' || fulfillmentStatus === 'CANCELED') return 'ملغي';
      if (fulfillmentStatus === 'RETURNED' || fulfillmentStatus === 'RESTOCKED') return 'تمت_الاعادة_لشركة_الشحن';
      if (fulfillmentStatus === 'HOLD' || fulfillmentStatus === 'ON_HOLD' || tags?.some((t:any) => t.name?.toLowerCase() === 'hold' || t.name === 'مؤجل' || t.name === 'هولد')) return 'مؤجل';
      if (fulfillmentStatus === 'SCHEDULED' || tags?.some((t:any) => t.name?.toLowerCase() === 'scheduled' || t.name === 'مجدول')) return 'مجدول';
      
      if (!shippingStatus) {
          if (fulfillmentStatus === 'FULFILLED') return 'قيد_التنفيذ';
          return 'في_انتظار_المكالمة';
      }
      const ss = shippingStatus.toUpperCase();
      if (ss === 'DELIVERED') return status === 'PAID' ? 'مدفوعة' : 'تم_توصيلها';
      if (ss === 'RETURNED' || ss === 'RTS' || ss === 'RETURNED_TO_SHIPPING_COMPANY' || ss.includes('RETURNED_TO_') || ss.includes('RETURN_TO_') || ss === 'RTO') return 'تمت_الاعادة_لشركة_الشحن';
      if (ss === 'FAILURE' || ss === 'FAILED') return 'فشل_التوصيل';
      if (ss === 'IN_TRANSIT') return 'قيد_الشحن';
      if (ss === 'SHIPPED') return 'تم_الارسال';
      if (ss === 'READY_FOR_PICKUP') return 'قيد_التنفيذ';
      if (ss === 'HOLD' || ss === 'ON_HOLD') return 'مؤجل';
      if (ss === 'SCHEDULED') return 'مجدول';
      return 'في_انتظار_المكالمة';
  }

  // API Sync Endpoint
  app.post("/api/sync/platform/:platform/:storeId", async (req, res) => {
    const { platform, storeId } = req.params;
    const { type = 'orders' } = req.query; // 'orders' or 'products'
    const selectedIds = req.body?.selectedIds; // Optional array of IDs to sync
    
    try {
        // 1. Get Store Settings and API Key
        const storeSnap = await getDoc(doc(db, 'stores_data', storeId));
        if (!storeSnap.exists()) return res.status(404).json({ error: "Store not found" });
        const storeRow = storeSnap.data();

        const settings = storeRow.settings || {};
        const platformConfigs = settings.platformConfigs || {};
        const config = platformConfigs[platform];

        if (!config || !config.apiKey) return res.status(400).json({ error: "API Key not configured for this platform" });

        // 2. Fetch from External Platform
        let itemsToProcess = [];

        if (platform === 'wuilt') {
            const rawStoreId = (config.shopId || config.shopUrl || '').trim();
            const apiKey = (config.apiKey || '').trim();
            
            // Extract Store ID if user accidentally provided the full URL
            let wuiltStoreId = rawStoreId;
            if (rawStoreId.includes('/store/')) {
                const parts = rawStoreId.split('/store/');
                if (parts[1]) {
                    wuiltStoreId = parts[1].split('/')[0];
                }
            }

            if (!wuiltStoreId) return res.status(400).json({ error: "Wuilt Store ID is required for sync" });
            if (!apiKey) return res.status(400).json({ error: "Wuilt API Key is required for sync" });

            const graphqlQuery = type === 'products' ? {
                query: `
                    query ListStoreProducts(
                      $connection: ProductsConnectionInput
                      $filter: ProductsFilterInput
                      $locale: String
                    ) {
                      products(connection: $connection, filter: $filter, locale: $locale) {
                        totalCount
                        nodes {
                          id
                          title
                          handle
                          type
                          status
                          source
                          isVisible
                          isArchived
                          locale
                          shortDescription
                          descriptionHtml
                          taxable
                          productTax
                          createdAt
                          updatedAt
                          images {
                            ...Image
                            __typename
                          }
                          seo {
                            title
                            description
                            __typename
                          }
                          options {
                            id
                            name
                            position
                            values {
                              id
                              name
                              __typename
                            }
                            __typename
                          }
                          attributes {
                            id
                            name
                            type
                            values {
                              id
                              name
                              __typename
                            }
                            __typename
                          }
                          variants(first: 50) {
                            nodes {
                              id
                              title
                              sku
                              price {
                                ...Money
                                __typename
                              }
                              compareAtPrice {
                                ...Money
                                __typename
                              }
                              cost {
                                ...Money
                                __typename
                              }
                              quantity
                              trackQuantity
                              selectedOptions {
                                option {
                                  id
                                  name
                                  __typename
                                }
                                value {
                                  id
                                  name
                                  __typename
                                }
                                __typename
                              }
                              externalId
                              cartLimitsEnabled
                              minPerCart
                              maxPerCart
                              createdAt
                              updatedAt
                              __typename
                            }
                            __typename
                          }
                          __typename
                        }
                        __typename
                      }
                    }

                    fragment Money on Money {
                      amount
                      currencyCode
                      __typename
                    }

                    fragment Image on Image {
                      id
                      src
                      altText
                      width
                      height
                      __typename
                    }
                `,
                variables: {
                    connection: {
                        first: 100,
                        offset: 0,
                        sortBy: "createdAt",
                        sortOrder: "desc"
                    },
                    filter: {
                      storeIds: [wuiltStoreId]
                    },
                    locale: "ar"
                }
            } : {
                // Orders Query
                query: `
                    query ListStoreOrders(
                      $storeId: ID!
                      $connection: OrdersConnectionInput
                      $filter: OrdersFilterInput
                    ) {
                      orders(storeId: $storeId, connection: $connection, filter: $filter) {
                        totalCount
                        nodes {
                          id
                          storeId
                          isArchived
                          isCanceled
                          fulfillmentStatus
                          paymentStatus
                          isViewed
                          orderSerial
                          shippingStatus
                          wuiltShipmentProvider
                          customer {
                            ...GuestInfo
                            __typename
                          }
                          cod {
                            amount {
                              ...Money
                              __typename
                            }
                            __typename
                          }
                          customerId
                          shippingRateCost {
                            ...Money
                            __typename
                          }
                          tags {
                            ...OrderTag
                            __typename
                          }
                          paymentIntent {
                            provider
                            paymentProvider
                            __typename
                          }
                          packagingDetails {
                            extraWeight
                            extraVolumetricWeight
                            shippingCostDetails {
                              baseCost
                              extraWeightCost
                              baseWeightLimit
                              extraWeightStep
                              insurancePercentage
                              __typename
                            }
                            __typename
                          }
                          shippingAddress {
                            ...Address
                            __typename
                          }
                          shipmentDetails {
                            trackingURL
                            shippedWith
                            shippingStatus
                            airWayBill
                            orderTrackingNumber
                            trials
                            __typename
                          }
                          returnShipmentDetails {
                            shippingStatus
                            orderTrackingNumber
                            __typename
                          }
                          receipt {
                            ...OrderReceipt
                            __typename
                          }
                          items {
                            id
                            quantity
                            title
                            price {
                              ...Money
                              __typename
                            }
                            __typename
                            productSnapshot {
                              id
                              title
                              type
                              images {
                                ...Image
                                __typename
                              }
                              __typename
                            }
                            ... on SimpleItem {
                              variantSnapshot {
                                id
                                sku
                                title
                                price {
                                  ...Money
                                  __typename
                                }
                                image {
                                  ...Image
                                  __typename
                                }
                                __typename
                              }
                              selectedOptions {
                                value
                                name
                                __typename
                              }
                              __typename
                            }
                          }
                          createdAt
                          __typename
                        }
                        __typename
                      }
                    }

                    fragment GuestInfo on Customer {
                      name
                      email
                      phone
                      isSubscribedToNewsLetter
                      __typename
                    }

                    fragment Money on Money {
                      amount
                      currencyCode
                      __typename
                    }

                    fragment OrderTag on OrderTag {
                      id
                      name
                      color
                      description
                      __typename
                    }

                    fragment Address on Address {
                      notes
                      addressLine1
                      addressLine2
                      phone
                      secondPhone
                      postalCode
                      areaSnapshot {
                        countryName
                        stateName
                        cityName
                        regionName
                        __typename
                      }
                      __typename
                    }

                    fragment OrderReceipt on OrderReceipt {
                      subtotal {
                        ...Money
                        __typename
                      }
                      discount {
                        ...Money
                        __typename
                      }
                      tax {
                        ...Money
                        __typename
                      }
                      shipping {
                        ...Money
                        __typename
                      }
                      total {
                        ...Money
                        __typename
                      }
                      automaticDiscount {
                        ...Money
                        __typename
                      }
                      __typename
                    }

                    fragment Image on Image {
                      id
                      src
                      altText
                      status
                      width
                      height
                      __typename
                    }
                `,
                variables: type === 'products' ? {
                    connection: {
                        first: 50,
                        offset: 0,
                        sortBy: "createdAt",
                        sortOrder: "desc"
                    },
                    filter: { storeIds: [wuiltStoreId] },
                    locale: "ar"
                } : {
                    storeId: wuiltStoreId,
                    connection: {
                        first: 50,
                        offset: 0,
                        sortBy: "createdAt",
                        sortOrder: "desc"
                    },
                    filter: {}
                }
            };

            const authHeader = apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
            
            console.log(`[SYNC] Fetching ${type} from Wuilt URL: https://graphql.wuilt.com for Store ID: ${wuiltStoreId}`);
            
            const response = await fetch('https://graphql.wuilt.com', {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'X-API-KEY': apiKey, // Try both formats for compatibility
                    'X-Wuilt-Store-Id': wuiltStoreId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Wuilt-Sync-Integration/1.0'
                },
                body: JSON.stringify(graphqlQuery)
            });

            const result: any = await response.json();

            if (!response.ok || result.errors) {
                console.error(`[SYNC] Wuilt API Error Details:`, JSON.stringify(result.errors || { status: response.status }));
                let errorMsg = result.errors ? result.errors[0].message : `Status ${response.status}`;
                
                if (response.status === 401) {
                    errorMsg = 'خطأ في المصادقة (401): يرجى التأكد من أن الـ API Key صحيح تماماً ومنشور (Published) من لوحة تحكم ويلت. تأكد أيضاً من أن "معرف المتجر" (Store ID) صحيح ويبدأ بـ Store_.';
                }
                
                return res.status(response.status || 400).json({ error: `Wuilt API Error: ${errorMsg}` });
            }

            console.log(`[SYNC] GraphQL Result Data Keys: ${Object.keys(result.data || {})}`);
            const productsData = result.data?.products;
            const ordersData = result.data?.orders;

            if (productsData) console.log(`[SYNC] Products Result structure: ${JSON.stringify({ totalCount: productsData.totalCount, nodesCount: productsData.nodes?.length, edgesCount: productsData.edges?.length })}`);
            if (ordersData) {
                console.log(`[SYNC] Orders Result structure: ${JSON.stringify({ totalCount: ordersData.totalCount, nodesCount: ordersData.nodes?.length, edgesCount: ordersData.edges?.length })}`);
                if (ordersData.nodes && ordersData.nodes.length > 0) {
                     console.log(`[SYNC] First raw order receipt:`, JSON.stringify(ordersData.nodes[0].receipt));
                     console.log(`[SYNC] First raw order items:`, JSON.stringify(ordersData.nodes[0].items));
                }
            }

            itemsToProcess = type === 'products' ? (productsData?.nodes || productsData?.edges?.map((e: any) => e.node) || []) : (ordersData?.nodes || ordersData?.edges?.map((e: any) => e.node) || []);
            
            // Filter by selectedIds if provided
            if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
                const idSet = new Set(selectedIds);
                itemsToProcess = itemsToProcess.filter((item: any) => {
                    const mappedId = `wuilt-${item.id}`;
                    return idSet.has(item.id) || idSet.has(mappedId);
                });
            }

            console.log(`[SYNC] Successfully fetched ${itemsToProcess.length} ${type} from Wuilt (Selected: ${selectedIds?.length || 'All'})`);
        } else {
            return res.status(400).json({ error: "Platform sync not yet implemented" });
        }

        // 3. Map and Save
        const table = type === 'products' ? 'products' : 'orders';
        const mapper = type === 'products' ? mapWuiltProduct : (item: any, id: string) => mapWuiltOrder(item, id, settings);

        const mappedItems = itemsToProcess.map(item => mapper(item, storeId)).filter(Boolean);
        
        if (mappedItems.length > 0) {
            import('fs').then(fs => {
               const logLine = `[${new Date().toISOString()}] Sync Store: ${storeId}, Items: ${mappedItems.length}\n` + 
                 mappedItems.slice(0, 10).map(m => {
                    const raw = itemsToProcess.find(i => `wuilt-${i.id}` === m.id);
                    const sStatus = raw?.shipmentDetails?.shippingStatus || raw?.shippingStatus;
                    return ` - Order #${(m as any).order_number}: Status=${(m as any).status} (shippingStatus: "${sStatus}", fStatus: "${raw?.fulfillmentStatus}", isArchived=${raw?.isArchived})`;
                 }).join('\n') + '\n---\n';
               fs.appendFileSync('sync_debug.log', logLine);
            });
            
            console.log(`[SYNC] Mapping result: ${mappedItems.length} items. Samples logged to sync_debug.log`);
            // Fetch existing items for this store
            const q = query(collection(db, table), where('store_id', '==', storeId));
            const querySnap = await getDocs(q);
            const existingSet = new Set(querySnap.docs.map(docSnap => docSnap.id));

            let existingOrdersMap: Record<string, string> = {};
            querySnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                existingOrdersMap[docSnap.id] = data.status || '';
            });
            
            const newItems = mappedItems.filter(o => !existingSet.has(o.id));
            const updateItems = mappedItems.filter(o => existingSet.has(o.id));

            if (newItems.length > 0) {
                for (const item of newItems) {
                    await setDoc(doc(db, table, item.id), cleanUndefined(item), { merge: true });
                }
            }

            // Update existing items (Sync both products and orders)
            if (updateItems.length > 0) {
                const terminalStatuses = ['مؤرشف', 'ملغي', 'تم_توصيلها', 'تم_التحصيل'];

                for (const item of updateItems) {
                    if (table === 'orders') {
                        const existingStatus = existingOrdersMap[item.id];
                        
                        // User Request: Synced orders should always take the status from the platform (Wuilt)
                        // EXCEPTION: If the synced status is 'في_انتظار_المكالمة' (the initial step), 
                        // but locally the user already pushed it forward (e.g. to 'قيد_التنفيذ'), 
                        // we shouldn't bump it back to the initial step.
                        
                        // So, we only strip the status if the platform is trying to set it to 'في_انتظار_المكالمة',
                        // AND locally it's already past that step.
                        const preserveStatuses = ['تم_التحصيل', 'مدفوعة', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مؤرشف', 'تم_الاستبدال'];
                        if (existingStatus && preserveStatuses.includes(existingStatus)) {
                             const { status, ...itemWithoutStatus } = (item as any);
                             await setDoc(doc(db, table, item.id), cleanUndefined(itemWithoutStatus), { merge: true });
                        } else if ((item as any).status === 'في_انتظار_المكالمة' && existingStatus && existingStatus !== 'في_انتظار_المكالمة') {
                             const { status, ...itemWithoutStatus } = (item as any);
                             await setDoc(doc(db, table, item.id), cleanUndefined(itemWithoutStatus), { merge: true });
                        } else {
                             await setDoc(doc(db, table, item.id), cleanUndefined(item), { merge: true });
                        }
                    } else {
                        await setDoc(doc(db, table, item.id), cleanUndefined(item), { merge: true });
                    }
                }
            }
            
            return res.json({ 
                success: true, 
                processed: mappedItems.length, 
                inserted: newItems.length, 
                updated: updateItems.length,
                items: mappedItems
            });
        }

        res.json({ success: true, processed: 0, inserted: 0, updated: 0, items: [] });

    } catch (error: any) {
        console.error(`[SYNC] Error syncing ${platform} ${type}:`, error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Local testing endpoints for Webhooks (Alternative to Edge Functions)
  app.post("/api/webhook/platform/:platform/:storeId/test", async (req, res) => {
    const { platform, storeId } = req.params;
    const payload = req.body;

    res.status(200).send("OK");

    if (payload.test) {
       console.log(`Received test webhook from ${platform}:`, payload);
       return;
    }

    setImmediate(async () => {
       try {
          const storeSnap = await getDoc(doc(db, 'stores_data', storeId));
          if (!storeSnap.exists()) { return; }
          const storeRow = storeSnap.data();
          
          let newOrder: any = null;

          if (platform === 'wuilt') {
             const { event, payload: wuiltPayload } = payload;
             if (event === 'ORDER_PLACED' || event === 'ORDER_FULFILLED' || event === 'ORDER_UPDATED') {
                 newOrder = mapWuiltOrder(wuiltPayload.order, storeId, storeRow.settings);
             }
          }

          if (newOrder) {
             await setDoc(doc(db, 'orders', newOrder.id), cleanUndefined(newOrder), { merge: true });
             console.log(`[TEST-WEBHOOK] Order ${newOrder.id} synced via test webhook`);
          }
       } catch (error) {
          console.error(`[WEBHOOK] Error processing ${platform} async task:`, error);
       }
    });
  });

  // Webhook handler logic for custom integrations
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
