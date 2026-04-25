
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const WUILT_GRAPHQL_ENDPOINT = 'https://graphql.wuilt.com/';

const QUERIES = {
    LIST_PRODUCTS: `
      query ListStoreProducts($filter: ProductsFilterInput) {
        products(filter: $filter) {
          nodes {
            id
            title
            descriptionHtml
            options {
              id
              name
              values {
                id
                value
              }
            }
            variants {
              nodes {
                id
                sku
                price {
                  amount
                }
                selectedOptions {
                  option { name }
                  value { value }
                }
              }
            }
            images {
              src
            }
          }
        }
      }
    `,
    LIST_ORDERS: `
      query ListStoreOrders($storeId: ID!, $filter: OrdersFilterInput) {
        orders(storeId: $storeId, filter: $filter) {
          nodes {
            id
            refCode
            createdAt
            status
            paymentStatus
            fulfillmentStatus
            shippingStatus
            totalPrice { amount }
            subtotal { amount }
            paidAmount { amount }
            shippingRateCost { amount }
            discounts {
              amount { amount }
              type
            }
            customer {
              name
              phone
              email
            }
            shippingAddress {
              addressLine1
              addressLine2
              phone
            }
            items {
              ... on SimpleItem {
                id
                title
                quantity
                price {
                  amount
                }
                product {
                  id
                  images {
                    src
                  }
                }
              }
            }
            packagingDetails {
              weight
            }
            notes
          }
        }
      }
    `
};

function normalizeWuiltProducts(data: any) {
  if (!data?.products?.nodes) return [];

  return data.products.nodes.map((node: any) => {
    const variants = node.variants?.nodes?.map((vNode: any) => ({
        id: vNode.id,
        sku: vNode.sku || `W-V-${vNode.id}`,
        price: typeof vNode.price === 'object' ? vNode.price?.amount : vNode.price || 0,
        stockQuantity: null,
        weight: 0,
        options: vNode.selectedOptions?.reduce((acc: any, so: any) => {
            if (so.option?.name && so.value?.value) {
                acc[so.option.name] = so.value.value;
            }
            return acc;
        }, {}) || {}
    })) || [];

    const firstVariant = variants[0];
    const images = node.images?.map((i: any) => i.src) || [];

    return {
      id: `wuilt-${node.id}`,
      sku: `W-${node.id}`,
      name: node.title,
      description: node.descriptionHtml || '',
      price: firstVariant?.price || 0,
      inStock: true,
      stockQuantity: null,
      thumbnail: images[0] || undefined,
      images: images,
      weight: 1,
      costPrice: 0,
      hasVariants: variants.length > 1,
      options: node.options?.map((o: any) => o.name) || [],
      variants: variants,
    };
  });
}

function normalizeWuiltOrders(data: any): any[] {
    if (!data?.orders?.nodes) return [];

    return data.orders.nodes.map((node: any) => {
        const customer = node.customer;
        const shippingAddress = node.shippingAddress;
        
        const items = (node.items || []).map((item: any) => {
            return {
                productId: item.product?.id ? `wuilt-${item.product.id}` : 'unknown',
                name: item.title,
                quantity: item.quantity,
                price: item.price?.amount || 0,
                cost: 0,
                weight: 0,
                thumbnail: item.product?.images?.[0]?.src,
                variantDescription: ''
            };
        });

        const addressParts = [
            shippingAddress?.addressLine1,
            shippingAddress?.addressLine2
        ].filter((p:any) => p && p.trim() !== '');
        
        const fullAddress = addressParts.join(', ');

        const finalWeight = node.packagingDetails?.weight || 0;
        let paymentStatus = 'بانتظار الدفع';
        if (node.paymentStatus === 'PAID') paymentStatus = 'مدفوع';
        else if (node.paymentStatus === 'PARTIALLY_PAID') paymentStatus = 'مدفوع جزئياً';
        else if (node.paymentStatus === 'REFUNDED') paymentStatus = 'مرتجع';

        let preparationStatus = 'بانتظار التجهيز';
        if (node.fulfillmentStatus === 'FULFILLED') preparationStatus = 'جاهز';

        let status = 'جاري_المراجعة';
        if (node.status === 'CANCELLED') status = 'ملغي';
        else if (node.status === 'ARCHIVED') status = 'مؤرشف';

        const orderNumber = node.refCode || node.id.split('_').pop()?.substring(0, 8).toUpperCase() || node.id;

        const subtotal = node.subtotal?.amount || 0;
        const totalAmount = node.totalPrice?.amount || subtotal;
        const shippingFee = node.shippingRateCost?.amount || 0;
        
        const statusMap: Record<string, string> = {
            'SUCCESSFUL': 'مؤكد',
            'PENDING': 'معلق',
            'CANCELLED': 'ملغي',
            'REFUNDED': 'مرتجع',
            'SHIPPED': 'تم الشحن',
            'DELIVERED': 'تم التوصيل',
            'NEW': 'جديد'
        };

        const displayStatus = statusMap[node.status] || node.status || 'جديد';
        const shipStatus = statusMap[node.shippingStatus || ''] || node.shippingStatus || '';

        return {
            id: `wuilt-${node.id}`,
            orderNumber: orderNumber,
            date: node.createdAt,
            shippingCompany: 'Wuilt',
            shippingArea: '',
            city: '',
            customerName: customer?.name || 'عميل مجهول',
            customerPhone: customer?.phone || shippingAddress?.phone || '',
            customerAddress: fullAddress || '',
            governorate: '',
            notes: (node.notes || '') + (customer?.email ? `\nالبريد الإلكتروني: ${customer.email}` : ''),
            items: items,
            shippingFee: shippingFee,
            totalAmount: totalAmount,
            productName: items.map((i:any) => i.name).join(', '),
            productPrice: subtotal,
            productCost: 0,
            weight: finalWeight,
            discount: node.discounts?.reduce((acc: number, d: any) => acc + (d.amount?.amount || 0), 0) || 0,
            status: status,
            paymentStatus: paymentStatus,
            preparationStatus: preparationStatus,
            includeInspectionFee: false,
            inspectionFee: 0,
            isInsured: false,
            insuranceFee: 0,
            isTaxed: false,
            taxAmount: Math.max(0, totalAmount - (subtotal + shippingFee)),
            sourcePlatform: 'wuilt',
            sourceStatus: `${displayStatus} / ${shipStatus}`.trim().replace(/\/$/, ''),
            classification: displayStatus,
            updated_at: new Date().toISOString()
        };
    });
}

async function wuiltRequest(apiKey: string, query: string, variables: any = {}, shopId?: string) {
    const headers: any = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
    };
    if (shopId) headers['x-wuilt-store-id'] = shopId;

    const response = await fetch(WUILT_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Wuilt API Error (${response.status}): ${errorBody}`);
    }

    const { data, errors } = await response.json();
    if (errors) throw new Error(`Wuilt GraphQL Errors: ${errors[0].message}`);
    return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("storeId");
    const platform = url.searchParams.get("platform");
    const type = url.searchParams.get("type") || "products";
    const isPreview = url.searchParams.get("preview") === "true";

    if (!storeId || !platform) {
      return new Response(JSON.stringify({ error: "Missing storeId or platform" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Get Store Credentials
    const { data: storeRow, error: storeError } = await supabase.from('stores_data').select('settings, name').eq('id', storeId).single();
    if (storeError || !storeRow) throw new Error("Store not found");

    const settings = storeRow.settings || {};
    const config = settings.platformConfigs?.[platform] || (settings.integration?.platform === platform ? settings.integration : null);

    let apiKey = config?.apiKey;
    let shopId = config?.shopId;

    // Allow providing credentials via body/query for initial setup preview
    if (isPreview) {
        apiKey = url.searchParams.get("apiKey") || apiKey;
        shopId = url.searchParams.get("shopId") || shopId;
    }

    if (!apiKey) throw new Error(`Platform ${platform} not configured for store ${storeId}`);

    // 2. Fetch from Platform
    let items = [];
    if (platform === 'wuilt') {
      if (type === 'products') {
        const data = await wuiltRequest(apiKey, QUERIES.LIST_PRODUCTS, { filter: { storeIds: shopId ? [shopId] : undefined } }, shopId);
        items = normalizeWuiltProducts(data);
      } else {
        if (!shopId) throw new Error("Shop ID required for Orders");
        const data = await wuiltRequest(apiKey, QUERIES.LIST_ORDERS, { storeId: shopId, filter: {} }, shopId);
        items = normalizeWuiltOrders(data);
      }
    }

    if (isPreview) {
      return new Response(JSON.stringify({ items }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Sync to Database
    if (type === 'products') {
      const productsPayload = items.map((p: any) => {
        const { id, name, sku, price, stockQuantity, ...details } = p;
        return { id, store_id: storeId, name, sku, price, stock_quantity: stockQuantity, details };
      });
      
      const { error: upsertError } = await supabase.from('products').upsert(productsPayload, { onConflict: 'id' });
      if (upsertError) throw upsertError;

      // Update settings backup
      const updatedSettings = { ...settings, products: items };
      await supabase.from('stores_data').update({ settings: updatedSettings }).eq('id', storeId);

    } else {
      const ordersPayload = items.map((o: any) => {
        const { id, orderNumber, customerName, status, date, ...details } = o;
        return { 
            id, 
            store_id: storeId, 
            order_number: orderNumber, 
            customer_name: customerName, 
            status, 
            date, 
            total_price: o.totalAmount, 
            details 
        };
      });
      const { error: upsertError } = await supabase.from('orders').upsert(ordersPayload, { onConflict: 'id' });
      if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({ success: true, count: items.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Sync Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
