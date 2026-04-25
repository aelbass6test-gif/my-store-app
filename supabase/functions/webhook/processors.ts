
type OrderData = {
    id: string;
    store_id: string;
    order_number: string;
    customer_name: string;
    status: string;
    date: string;
    details: any;
};

export type PlatformProcessor = (payload: any, storeId: string) => OrderData | null;

export const wuiltProcessor: PlatformProcessor = (payload: any, storeId: string) => {
    const { event, payload: wuiltPayload } = payload;
    if (event !== "ORDER_PLACED" && event !== "ORDER_UPDATED") return null;

    const orderData = wuiltPayload?.order;
    if (!orderData) return null;

    const id = `wuilt-${orderData._id || Date.now()}`;
    return {
        id,
        store_id: storeId,
        order_number: `W-${orderData.orderSerial || orderData._id}`,
        customer_name: orderData.customer?.name || "عميل ويلت",
        status: "جديد",
        date: orderData.createdAt || new Date().toISOString(),
        details: {
            shippingCompany: orderData.wuiltShipmentProvider || orderData.shippingRateName || "ويلت",
            shippingArea: orderData.shippingAddress?.stateName || "غير محدد",
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
            productName: (orderData.items && orderData.items[0]) ? orderData.items[0].title : "طلب عبر ويلت",
            productPrice: orderData.subtotal?.amount || 0,
            productCost: 0,
            weight: orderData.packagingDetails?.weight || 0,
            discount: orderData.receipt?.discount?.amount || 0,
            paymentStatus: orderData.paymentStatus === "PAID" ? "تم الدفع" : "معلق",
            preparationStatus: "قيد التجهيز",
            platformOrderId: orderData._id,
            paymentMethod: orderData.paymentMethod === "CASH_ON_DELIVERY" ? "الدفع عند الاستلام" : orderData.paymentMethod,
        }
    };
};

export const defaultProcessor: PlatformProcessor = (payload: any, storeId: string) => {
    return {
        id: payload.id || crypto.randomUUID(),
        store_id: storeId,
        order_number: payload.orderNumber || `WH-${Date.now()}`,
        customer_name: payload.customerName || "عميل",
        status: payload.status || "جديد",
        date: payload.date || new Date().toISOString(),
        details: payload.details || { ...payload }
    };
};

export const processors: Record<string, PlatformProcessor> = {
    wuilt: wuiltProcessor,
};
