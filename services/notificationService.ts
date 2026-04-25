
import { Order, Settings } from '../types';

export const sendTelegramNotification = async (order: Order, settings: Settings) => {
    // Check if Telegram notification is enabled in settings
    // Since we didn't add it to settings yet, I'll use a placeholder check for now
    // or just look for telegram data in integration platform configs as extra fields
    
    // For this example, let's assume we store telegram config in settings.integration or a new field
    // @ts-ignore
    const telegramConfig = settings.telegramNotifications;
    
    if (!telegramConfig || !telegramConfig.isActive || !telegramConfig.botToken || !telegramConfig.chatId) {
        return;
    }

    const message = `
🔔 **طلب جديد مستلم!**
---
**رقم الطلب:** #${order.orderNumber}
**العميل:** ${order.customerName}
**الهاتف:** ${order.customerPhone}
**القيمة:** ${order.totalAmount} ج.م
**المنصة:** ${order.sourcePlatform || 'متجر المحمول'}
---
[فتح لوحة التحكم](https://${window.location.hostname}/orders)
    `.trim();

    try {
        const url = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramConfig.chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        console.log('[NotificationService] Telegram notification sent.');
    } catch (error) {
        console.error('[NotificationService] Error sending Telegram notification:', error);
    }
};

export const logActivity = (settings: Settings, setSettings: any, action: string, details: string, type: 'order' | 'stock' | 'system' | 'sync' | 'financial' = 'system') => {
    const newLog = {
        id: `log-${Date.now()}`,
        user: 'النظام',
        action,
        details,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        type
    };

    setSettings((prev: Settings) => ({
        ...prev,
        activityLogs: [newLog, ...(prev.activityLogs || [])].slice(0, 50) // Keep last 50
    }));
};
