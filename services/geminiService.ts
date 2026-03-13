import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function chatWithAI(message: string, settings: any, orders: any[], useThinkingMode: boolean) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `أنت مساعد ذكي لمدير متجر إلكتروني. الإعدادات: ${JSON.stringify(settings)}. الطلبات: ${JSON.stringify(orders)}. وضع التفكير: ${useThinkingMode}`,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error chatting with AI:", error);
    return "عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي.";
  }
}

export async function searchProductsWithAI(query: string, products: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `ابحث عن المنتجات التي تطابق هذا الوصف: "${query}". قائمة المنتجات: ${JSON.stringify(products)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING }
            }
          }
        }
      }
    });
    const result = JSON.parse(response.text || "[]");
    const matchedIds = result.map((r: any) => r.id);
    return products.filter(p => matchedIds.includes(p.id));
  } catch (error) {
    console.error("Error searching products with AI:", error);
    return products; // Fallback to all products
  }
}

export async function generateShippingNote(order: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `قم بإنشاء ملاحظة شحن قصيرة ومناسبة لشركة الشحن بناءً على تفاصيل الطلب التالية: ${JSON.stringify(order)}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating shipping note:", error);
    return "الرجاء التعامل مع الشحنة بعناية.";
  }
}

export async function generateAdCopy(product: any, platform: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `اكتب نص إعلاني جذاب لمنتج "${product.name}" لمنصة ${platform}. تفاصيل المنتج: ${product.description || ''}. السعر: ${product.price}.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating ad copy:", error);
    return "نص إعلاني مميز لمنتجك.";
  }
}

export async function getAnalyticsFromAI(query: string, orders: any[], settings: any, wallet: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `قم بتحليل بيانات المبيعات التالية بناءً على الاستفسار: "${query}". الطلبات: ${JSON.stringify(orders)}. الإعدادات: ${JSON.stringify(settings)}. المحفظة: ${JSON.stringify(wallet)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysisText: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{"analysisText": "تحليل البيانات غير متاح حالياً."}');
  } catch (error) {
    console.error("Error getting analytics from AI:", error);
    return "تحليل البيانات غير متاح حالياً.";
  }
}

export async function generateDashboardSuggestions(orders: any[], products: any[], customers: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `بناءً على بيانات المتجر التالية، اقترح 3 إجراءات سريعة يمكن لصاحب المتجر اتخاذها لتحسين الأداء. الطلبات: ${JSON.stringify(orders)}. المنتجات: ${JSON.stringify(products)}. العملاء: ${JSON.stringify(customers)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error generating dashboard suggestions:", error);
    return ["راجع الطلبات المعلقة", "تأكد من توفر المخزون", "تحقق من رسائل العملاء"];
  }
}

export async function generateProductDescription(name: string, details: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `اكتب وصفاً تسويقياً جذاباً لمنتج باسم "${name}". التفاصيل الإضافية: ${details}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating product description:", error);
    return "وصف المنتج غير متاح.";
  }
}

export async function generateSocialMediaPost(name: string, description: string, price: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `اكتب منشوراً لمنصات التواصل الاجتماعي للترويج لهذا المنتج: الاسم: ${name}. الوصف: ${description}. السعر: ${price}. استخدم الهاشتاجات المناسبة.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating social media post:", error);
    return "منشور ترويجي للمنتج.";
  }
}
