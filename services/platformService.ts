

import { Product, Order, OrderItem, PaymentStatus, PreparationStatus, OrderStatus } from '../types';
import { supabase } from './supabaseClient';

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
    `,
    CREATE_PRODUCT: `
        mutation createProduct($input: CreateProductInput!, $storeId: ID!) {
            createProduct(input: $input, storeId: $storeId) {
                product {
                    id
                    title
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `,
    UPDATE_PRODUCT: `
        mutation updateProduct($input: UpdateProductInput!, $storeId: ID!) {
            updateProduct(input: $input, storeId: $storeId) {
                product {
                    id
                    title
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `,
    UPDATE_VARIANT: `
        mutation updateProductVariant($input: UpdateProductVariantInput!, $storeId: ID!) {
            updateProductVariant(input: $input, storeId: $storeId) {
                variant {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `,
    CREATE_OPTION: `
        mutation createProductOption($input: CreateProductOptionInput!, $storeId: ID!) {
            createProductOption(input: $input, storeId: $storeId) {
                option {
                    id
                    name
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `,
    CREATE_OPTION_VALUE: `
        mutation createProductOptionValue($input: CreateProductOptionValueInput!, $storeId: ID!) {
            createProductOptionValue(input: $input, storeId: $storeId) {
                value {
                    id
                    value
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `,
    CREATE_ATTRIBUTE_VALUE: `
        mutation createProductAttributeValue($input: CreateProductAttributeValueInput!, $storeId: ID!) {
            createProductAttributeValue(input: $input, storeId: $storeId) {
                value {
                    id
                    value
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `,
    GET_PRODUCT_BY_HANDLE: `
        query storeProductByHandle($handle: String!, $storeId: ID!) {
            storeProductByHandle(handle: $handle, storeId: $storeId) {
                id
                title
                descriptionHtml
                src
                variants {
                    nodes {
                        id
                        price {
                            amount
                        }
                    }
                }
            }
        }
    `
};

const normalizeWuiltProducts = (data: any): Product[] => {
  if (!data?.products?.nodes) return [];

  return data.products.nodes.map((node: any): Product => {
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
      id: `wuilt-${node.id}`, // Prefix to avoid collisions
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
};

const normalizeWuiltOrders = (data: any): Order[] => {
    if (!data?.orders?.nodes) return [];

    return data.orders.nodes.map((node: any): Order => {
        const customer = node.customer;
        const shippingAddress = node.shippingAddress;
        
        const items: OrderItem[] = (node.items || []).map((item: any) => {
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
        ].filter(p => p && p.trim() !== '');
        
        const fullAddress = addressParts.join(', ');

        const finalWeight = node.packagingDetails?.weight || 0;
        let paymentStatus: PaymentStatus = 'بانتظار الدفع';
        if (node.paymentStatus === 'PAID') paymentStatus = 'مدفوع';
        else if (node.paymentStatus === 'PARTIALLY_PAID') paymentStatus = 'مدفوع جزئياً';
        else if (node.paymentStatus === 'REFUNDED') paymentStatus = 'مرتجع';

        // Map Preparation Status (Fulfillment)
        let preparationStatus: PreparationStatus = 'بانتظار التجهيز';
        if (node.fulfillmentStatus === 'FULFILLED') preparationStatus = 'جاهز';

        // Map Order Status
        let status: OrderStatus = 'جاري_المراجعة';
        if (node.status === 'CANCELLED') status = 'ملغي';
        else if (node.status === 'ARCHIVED') status = 'مؤرشف';

        // Real Order Number: Use refCode if available, otherwise short version of ID
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
            productName: items.map(i => i.name).join(', '),
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
            classification: displayStatus
        };
    });
};

export async function wuiltRequest(apiKey: string, query: string, variables: any = {}, shopId?: string) {
    const headers: any = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
    };

    if (shopId) {
        headers['x-wuilt-store-id'] = shopId;
    }

    const response = await fetch(WUILT_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Wuilt API Error (${response.status}): ${errorBody}`);
    }

    const responseText = await response.text();
    let json;
    try {
        json = JSON.parse(responseText);
    } catch (e) {
        throw new Error(`Invalid JSON response from Wuilt API: ${responseText.substring(0, 100)}...`);
    }

    if (json.errors) {
        throw new Error(`Wuilt GraphQL Errors: ${json.errors[0].message}`);
    }
    return json.data;
}

export const fetchWuiltProducts = async (apiKey: string, shopId?: string): Promise<Product[]> => {
    try {
        const data = await wuiltRequest(apiKey, QUERIES.LIST_PRODUCTS, { filter: { storeIds: shopId ? [shopId] : undefined } }, shopId);
        return normalizeWuiltProducts(data);
    } catch (error) {
        console.error('fetchWuiltProducts failed:', error);
        throw error;
    }
};

export const fetchWuiltOrders = async (apiKey: string, shopId?: string): Promise<Order[]> => {
    try {
        if (!shopId) throw new Error('Shop ID (Store ID) is required for Orders sync.');
        const data = await wuiltRequest(apiKey, QUERIES.LIST_ORDERS, { storeId: shopId, filter: {} }, shopId);
        return normalizeWuiltOrders(data);
    } catch (error) {
        console.error('fetchWuiltOrders failed:', error);
        throw error;
    }
};

export const createWuiltProduct = async (apiKey: string, input: any, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Create Product');
    return wuiltRequest(apiKey, QUERIES.CREATE_PRODUCT, { input, storeId: shopId }, shopId);
};

export const updateWuiltProduct = async (apiKey: string, input: any, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Update Product');
    return wuiltRequest(apiKey, QUERIES.UPDATE_PRODUCT, { input, storeId: shopId }, shopId);
};

export const updateWuiltVariant = async (apiKey: string, input: any, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Update Variant');
    return wuiltRequest(apiKey, QUERIES.UPDATE_VARIANT, { input, storeId: shopId }, shopId);
};

export const createWuiltOption = async (apiKey: string, input: any, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Create Option');
    return wuiltRequest(apiKey, QUERIES.CREATE_OPTION, { input, storeId: shopId }, shopId);
};

export const createWuiltOptionValue = async (apiKey: string, input: any, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Create Option Value');
    return wuiltRequest(apiKey, QUERIES.CREATE_OPTION_VALUE, { input, storeId: shopId }, shopId);
};

export const createWuiltAttributeValue = async (apiKey: string, input: any, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Create Attribute Value');
    return wuiltRequest(apiKey, QUERIES.CREATE_ATTRIBUTE_VALUE, { input, storeId: shopId }, shopId);
};

export const getWuiltProductByHandle = async (apiKey: string, handle: string, shopId?: string) => {
    if (!shopId) throw new Error('Shop ID is required for Get Product');
    return wuiltRequest(apiKey, QUERIES.GET_PRODUCT_BY_HANDLE, { handle, storeId: shopId }, shopId);
};

// --- Browser-Side Sync Logic (Fallback for missing server) ---

export const browserSyncPlatform = async (platformId: string, storeId: string, type: 'products' | 'orders', selectedIds?: string[]) => {
    console.log(`[BrowserSync] Syncing ${type} for ${platformId} / ${storeId}...`);
    
    // 1. Get Config from Supabase
    const { data: config, error: configError } = await supabase
        .from('platform_configs')
        .select('*')
        .eq('store_id', storeId)
        .eq('platform_id', platformId)
        .single();
        
    if (configError || !config) {
        throw new Error(`لم يتم العثور على إعدادات للمنصة ${platformId}`);
    }

    const { apiKey, shopId, isActive } = config;
    if (!isActive) throw new Error('المنصة غير نشطة');

    if (platformId === 'wuilt') {
        if (type === 'products') {
            const products = await fetchWuiltProducts(apiKey, shopId);
            const filtered = selectedIds ? products.filter(p => selectedIds.includes(p.id.replace('wuilt-', ''))) : products;
            
            // Upsert to Supabase directly
            const { error: upsertError } = await supabase.from('products').upsert(
                filtered.map(p => ({ ...p, store_id: storeId }))
            );
            
            if (upsertError) throw upsertError;
            return { count: filtered.length };
        } else {
            const orders = await fetchWuiltOrders(apiKey, shopId);
            // Upsert orders
            const { error: upsertError } = await supabase.from('orders').upsert(
                orders.map(o => ({ ...o, store_id: storeId }))
            );
            if (upsertError) throw upsertError;
            return { count: orders.length };
        }
    }
    
    throw new Error(`المزامنة المباشرة غير مدعومة للمنصة ${platformId}`);
};
