import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Helper to map Wuilt order data to internal schema
function mapWuiltOrder(order: any, storeId: string) {
    if (!order) return null;

    const id = `wuilt-${order.id}`;
    
    const financial = order.receipt || {};
    const totalPrice = financial.total?.amount || 0;
    const subtotal = financial.subtotal?.amount || 0;
    const discount = financial.discount?.amount || 0;
    const shippingFee = financial.shipping?.amount || 0;

    // Status mapping based on Wuilt fulfillment status
    let mappedStatus = 'في_انتظار_المكالمة'; // Default for UNFULFILLED is waiting for call
    if (order.fulfillmentStatus === 'FULFILLED') {
        mappedStatus = 'قيد_التنفيذ';
    } else if (order.fulfillmentStatus === 'CANCELED') {
        mappedStatus = 'ملغي';
    } else if (order.fulfillmentStatus === 'AWAITING_FULFILLMENT') {
        mappedStatus = 'في_انتظار_المكالمة';
    }

    return {
        id,
        store_id: storeId,
        order_number: order.orderSerial ? `W-${order.orderSerial}` : `W-${Date.now()}`,
        customer_name: order.customer?.name || 'عميل ويلت',
        status: mappedStatus,
        date: order.createdAt || new Date().toISOString(),
        total_price: totalPrice,
        details: {
            shippingCompany: order.wuiltShipmentProvider || 'ويلت',
            shippingArea: order.shippingAddress?.areaSnapshot?.stateName || order.shippingAddress?.stateName || 'غير محدد',
            customerPhone: order.customer?.phone || order.shippingAddress?.phone || 'غير متوفر',
            customerPhone2: order.shippingAddress?.secondPhone || '',
            customerAddress: `${order.shippingAddress?.addressLine1 || ''} ${order.shippingAddress?.addressLine2 || ''}`.trim() || 'لا يوجد عنوان',
            city: order.shippingAddress?.areaSnapshot?.cityName || order.shippingAddress?.cityName || '',
            governorate: order.shippingAddress?.areaSnapshot?.stateName || order.shippingAddress?.stateName || '',
            notes: order.shippingAddress?.notes || '',
            items: (order.items || []).map((item: any) => ({
                productId: item.productSnapshot?.id || item.id,
                name: item.title || 'منتج',
                quantity: item.quantity || 1,
                price: item.variantSnapshot?.price || 0,
                cost: 0,
                weight: 0
            })),
            shippingFee: shippingFee,
            productName: (order.items && order.items[0]) ? order.items[0].title : 'طلب عبر ويلت', 
            productPrice: subtotal,
            productCost: 0,
            weight: order.packagingDetails?.extraWeight || 0,
            discount: discount,
            includeInspectionFee: false,
            isInsured: false,
            paymentStatus: order.paymentStatus === 'PAID' ? 'تم الدفع' : 'معلق',
            preparationStatus: order.fulfillmentStatus === 'FULFILLED' ? 'تم التجهيز' : 'قيد التجهيز',
            platform: 'wuilt',
            platformOrderId: order.id,
            paymentMethod: order.paymentIntent?.paymentProvider || 'غير محدد'
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
                              packageDetails {
                                weight
                                dimensions {
                                  length
                                  width
                                  height
                                  __typename
                                }
                                __typename
                              }
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
        const mapper = type === 'products' ? mapWuiltProduct : mapWuiltOrder;

        const mappedItems = itemsToProcess.map(item => mapper(item, storeId)).filter(Boolean);
        
        if (mappedItems.length > 0) {
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
                for (const item of updateItems) {
                    // For orders, we might want to preserve some local fields, but for now we sync as requested
                    await supabase.from(table).update(item).eq('id', item.id);
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
                 newOrder = mapWuiltOrder(wuiltPayload.order, storeId);
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
