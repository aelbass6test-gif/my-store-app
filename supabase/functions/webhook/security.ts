
// supabase/functions/webhook/security.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

export const verifySignature = async (payload: string, signature: string, secret: string) => {
    // ... same ...
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    
    return await crypto.subtle.verify(
        'HMAC',
        key,
        Uint8Array.from(atob(signature), c => c.charCodeAt(0)),
        encoder.encode(payload)
    );
};

export const getWebhookSettings = async (platform: string, storeId: string) => {
    const { data } = await supabase
        .from('webhook_settings')
        .select('*')
        .eq('platform', platform)
        .eq('store_id', storeId)
        .single();
    return data;
};

export const sendWhatsAppAlert = async (message: string, platform: string, storeId: string) => {
    const settings = await getWebhookSettings(platform, storeId);
    if (!settings || !settings.whatsapp_api_url) return;

    try {
        await fetch(settings.whatsapp_api_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
    } catch (e) {
        console.error("Failed to send WhatsApp alert:", e);
    }
};
