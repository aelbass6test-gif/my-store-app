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
                       shipmentDetails.shippingFee?.amount ?? shipmentDetails.shippingFee ?? 
                       order.packagingDetails?.shippingCostDetails?.baseCost ??
                       order.shippingRateCost?.amount ?? order.shippingRateCost ?? 0;

    // Status mapping based on Wuilt fulfillment/shipping status
    let mappedStatus = 'جاري_المراجعة'; 
    
    // Priority 1: Terminal platform flags
    const isActuallyArchived = order.isArchived === true;
    const isActuallyCanceled = order.isCanceled === true || order.fulfillmentStatus === 'CANCELED';

    // Priority 2: Shipment status (more specific for tracking)
    const wuiltShipmentStatus = shipmentDetails.shippingStatus || order.shippingStatus;
    
    if (isActuallyArchived) {
        mappedStatus = 'مؤرشف';
    } else if (isActuallyCanceled) {
        mappedStatus = 'ملغي';
    } else if (wuiltShipmentStatus) {
        const ss = wuiltShipmentStatus.toUpperCase();
        if (ss === 'DELIVERED') {
            mappedStatus = 'تم_توصيلها';
        } else if (ss === 'RETURNED' || ss === 'RTS') {
            mappedStatus = 'مرتجع';
        } else if (ss === 'FAILURE' || ss === 'FAILED') {
            mappedStatus = 'فشل_التوصيل';
        } else if (ss === 'IN_TRANSIT') {
            mappedStatus = 'قيد_الشحن'; 
        } else if (ss === 'SHIPPED') {
            mappedStatus = 'تم_الارسال'; 
        } else if (ss === 'READY_FOR_PICKUP') {
            mappedStatus = 'قيد_التنفيذ'; // جاهز وفي انتظار المندوب
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
            customerAddress: order.shippingAddress?.addressLine1 || order.shippingAddress?.addressLine2 || 'لا يوجد عنوان',
            city: order.shippingAddress?.areaSnapshot?.cityName || order.shippingAddress?.cityName || '',
            governorate: mappedGovernorate,
            notes: order.shippingAddress?.notes || '',
            items: (order.items || []).map((item: any) => ({
                productId: `wuilt-${item.productSnapshot?.id || item.id}`,
                name: item.title || 'منتج',
                quantity: item.quantity || 1,
                price: item.variantSnapshot?.price?.amount || item.variantSnapshot?.price || item.productSnapshot?.price?.amount || 0,
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
            includeInspectionFee: order.packagingDetails?.isOpenShipment ?? order.shipmentDetails?.allowOpen ?? order.tags?.some((t:any) => t.name === 'open_shipment' || t.name === 'inspection') === true ? true : defaultIncludeInspection,
            isInsured: ((order.packagingDetails?.shippingCostDetails?.insurancePercentage || 0) > 0) || order.packagingDetails?.isInsured || order.shipmentDetails?.hasInsurance || order.tags?.some((t:any) => t.name === 'insured') === true ? true : defaultIsInsured,
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
    
    return {
        id: `wuilt-${product.id}`,
        store_id: storeId,
        name: product.title || 'منتج بدون اسم',
        sku: firstVariant?.sku || `W-${product.id}`,
        price: firstVariant?.price?.amount || 0,
        stock_quantity: firstVariant?.trackQuantity ? (firstVariant?.quantity ?? 0) : null,
        details: {
            description: product.descriptionHtml || product.shortDescription || '',
            costPrice: firstVariant?.cost?.amount || 0,
            images: images,
            thumbnail: images[0] || '',
            type: product.type,
            status: product.status,
            handle: product.handle,
            trackQuantity: firstVariant?.trackQuantity ?? false,
            variants: (product.variants?.nodes || []).map((v: any) => ({
                id: v.id,
                title: v.title,
                sku: v.sku,
                price: v.price?.amount || 0,
                cost: v.cost?.amount || 0,
                quantity: v.trackQuantity ? (v.quantity ?? 0) : null,
                trackQuantity: v.trackQuantity ?? false
            })),
            options: (product.options || []).map((o: any) => ({
                id: o.id,
                name: o.name,
                values: (o.values || []).map((v: any) => v.name)
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
  
  // NOTE: This server uses the anon key or service role key if available.
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Sync Preview Endpoint (Fetches data without saving)
  app.get("/api/sync/platform/:platform/:storeId/preview", async (req, res) => {
    const { platform, storeId } = req.params;
    const { type = 'products' } = req.query; // Default to products for preview
    
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });

    try {
        const { data: storeRow } = await supabase.from('stores_data').select('settings').eq('id', storeId).single();
        if (!storeRow) return res.status(404).json({ error: "Store not found" });
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

  // API Sync Endpoint
  app.post("/api/sync/platform/:platform/:storeId", async (req, res) => {
    const { platform, storeId } = req.params;
    const { type = 'orders' } = req.query; // 'orders' or 'products'
    const { selectedIds } = req.body; // Optional array of IDs to sync
    
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });

    try {
        // 1. Get Store Settings and API Key
        const { data: storeRow, error: storeError } = await supabase
            .from('stores_data')
            .select('*')
            .eq('id', storeId)
            .single();

        if (storeError || !storeRow) return res.status(404).json({ error: "Store not found" });

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
                variables: {
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
            if (ordersData) console.log(`[SYNC] Orders Result structure: ${JSON.stringify({ totalCount: ordersData.totalCount, nodesCount: ordersData.nodes?.length, edgesCount: ordersData.edges?.length })}`);

            itemsToProcess = type === 'products' ? (productsData?.nodes || productsData?.edges?.map((e: any) => e.node) || []) : (ordersData?.nodes || ordersData?.edges?.map((e: any) => e.node) || []);
            
            // Filter by selectedIds if provided
            if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
                const idSet = new Set(selectedIds);
                itemsToProcess = itemsToProcess.filter((item: any) => idSet.has(item.id));
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
                 mappedItems.slice(0, 5).map(m => {
                    const raw = itemsToProcess.find(i => `wuilt-${i.id}` === m.id);
                    return ` - Order #${(m as any).order_number}: Status=${(m as any).status} (Raw keys: ${Object.keys(raw || {}).join(',')}, isArchived=${raw?.isArchived})`;
                 }).join('\n') + '\n---\n';
               fs.appendFileSync('sync_debug.log', logLine);
            });
            
            console.log(`[SYNC] Mapping result: ${mappedItems.length} items. Samples logged to sync_debug.log`);
            // Check for duplicates before batch insert
            const { data: existingIds } = await supabase.from(table).select('id').in('id', mappedItems.map(o => o.id));
            const existingSet = new Set(existingIds?.map(i => i.id) || []);
            
            const newItems = mappedItems.filter(o => !existingSet.has(o.id));
            const updateItems = mappedItems.filter(o => existingSet.has(o.id));

            if (newItems.length > 0) {
                const { error: insertError } = await supabase.from(table).insert(newItems);
                if (insertError) throw insertError;
            }

            // Update existing items (Sync both products and orders)
            if (updateItems.length > 0) {
                // Batch fetch existing statuses to avoid per-order database calls
                let existingOrdersMap: Record<string, string> = {};
                if (table === 'orders') {
                    const { data: currentOrders } = await supabase
                        .from('orders')
                        .select('id, status')
                        .in('id', updateItems.map(o => o.id));
                    
                    if (currentOrders) {
                        currentOrders.forEach(o => {
                            existingOrdersMap[o.id] = o.status;
                        });
                    }
                }

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
                        if ((item as any).status === 'في_انتظار_المكالمة' && existingStatus && existingStatus !== 'في_انتظار_المكالمة') {
                             const { status, ...itemWithoutStatus } = (item as any);
                             await supabase.from(table).update(itemWithoutStatus).eq('id', item.id);
                        } else {
                             await supabase.from(table).update(item).eq('id', item.id);
                        }
                    } else {
                        await supabase.from(table).update(item).eq('id', item.id);
                    }
                }
            }
            
            return res.json({ 
                success: true, 
                processed: mappedItems.length, 
                inserted: newItems.length, 
                updated: updateItems.length 
            });
        }

        res.json({ success: true, processed: 0, inserted: 0 });

    } catch (error: any) {
        console.error(`[SYNC] Error syncing ${platform} ${type}:`, error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Local testing endpoints for Webhooks (Alternative to Edge Functions)
  app.post("/api/webhook/platform/:platform/:storeId", async (req, res) => {
    const { platform, storeId } = req.params;
    const payload = req.body;

    res.status(200).send("OK");

    if (payload.test) {
       console.log(`Received test webhook from ${platform}:`, payload);
       return;
    }

    setImmediate(async () => {
       try {
          if (!supabase) { return; }

          const { data: storeRow, error: storeError } = await supabase
            .from('stores_data')
            .select('*')
            .eq('id', storeId)
            .single();

          if (storeError || !storeRow) { return; }
          
          let newOrder: any = null;

          if (platform === 'wuilt') {
             const { event, payload: wuiltPayload } = payload;
             if (event === 'ORDER_PLACED' || event === 'ORDER_FULFILLED' || event === 'ORDER_UPDATED') {
                 newOrder = mapWuiltOrder(wuiltPayload.order, storeId, storeRow.settings);
             }
          }

          if (newOrder) {
             const { data: existing } = await supabase.from('orders').select('*').eq('id', newOrder.id).single();
             
             if (existing) {
                // Update existing order status if needed
                const { error: updateError } = await supabase.from('orders').update(newOrder).eq('id', newOrder.id);
                if (updateError) console.error(`[WEBHOOK] Failed to update order:`, updateError);
             } else {
                const { error: insertError } = await supabase.from('orders').insert([newOrder]);
                if (insertError) console.error(`[WEBHOOK] Failed to insert new order:`, insertError);
             }
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
