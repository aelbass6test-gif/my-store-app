import { supabase } from './supabaseClient';
import { Store, StoreData, User, Product, Order, Transaction, Supplier, SupplyOrder, Review, AbandonedCart, ActivityLog, Employee, DiscountCode, Collection, CustomPage, PaymentMethod, CustomerProfile, GlobalOption, ShippingCarrierIntegration } from '../types';
import { INITIAL_SETTINGS } from '../constants';

const LOCAL_STORAGE_PREFIX = 'wuilt_backup_';

// --- Local Storage Helpers (Backup) ---
const getLocal = (key: string) => {
    try {
        const item = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error('LocalStorage read error', e);
        return null;
    }
};

const saveLocal = (key: string, data: any) => {
    try {
        if (key !== 'global' && data && data.settings) {
            // It's a store data object. Let's make it lighter for backup to avoid quota errors.
            const liteData = {
                ...data,
                settings: {
                    ...data.settings,
                    // Replace large, non-critical arrays with empty ones for the local backup.
                    // The primary source of truth is the database.
                    products: [],
                    supplyOrders: [],
                    reviews: [],
                    abandonedCarts: [],
                    activityLogs: [],
                },
                // Also, truncate transactional data for local backup
                orders: data.orders ? data.orders.slice(0, 50) : [],
                wallet: data.wallet ? {
                    ...data.wallet,
                    transactions: data.wallet.transactions ? data.wallet.transactions.slice(0, 100) : []
                } : { balance: 0, transactions: [] },
                customers: data.customers ? data.customers.slice(0, 100) : []
            };

            localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(liteData));

        } else {
            // For global data (users, etc.), save it completely as it's usually small.
            localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(data));
        }
    } catch (e) {
        // If it still fails, log a warning. The app can function without local backup.
        console.warn(`LocalStorage backup for '${key}' failed, likely due to storage limits. The app will continue, relying on the primary database.`, e);
    }
};

// FIX: Define fetchLegacyDocument to resolve "Cannot find name" error.
const fetchLegacyDocument = async (docId: string): Promise<any> => {
    try {
        const { data, error } = await supabase
            .from('documents')
            .select('content')
            .eq('id', docId)
            .single();

        if (error || !data) {
            console.warn(`Legacy document ${docId} not found.`);
            return getLocal(docId); // Fallback to local storage if not in DB
        }
        return data.content;
    } catch (err) {
        console.error(`Error fetching legacy document ${docId}:`, err);
        return getLocal(docId); // Fallback to local storage on error
    }
};


export const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
        const { error } = await supabase.from('stores_data').select('id').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
};

/**
 * Ensures a parent record for the store exists in the `stores_data` table.
 * This is crucial to call before any operation that has a foreign key constraint on `stores_data`.
 */
export const ensureStoreRecordExists = async (storeId: string, storeName: string): Promise<{ success: boolean, error?: string }> => {
    try {
        const { error } = await supabase
            .from('stores_data')
            .upsert({ id: storeId, name: storeName }, { onConflict: 'id' });
        if (error) throw error;
        console.log(`Ensured store record exists for ${storeId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Failed to ensure store record exists:", err);
        return { success: false, error: err.message };
    }
};

// --- Relational Data Functions ---

export const getStoreData = async (storeId: string): Promise<StoreData | null> => {
    try {
        // Parallel Fetching for ALL 17 Tables
        const [
            storeRes,
            productsRes,
            ordersRes,
            transactionsRes,
            suppliersRes,
            supplyOrdersRes,
            reviewsRes,
            abandonedCartsRes,
            activityLogsRes,
            employeesRes,
            discountsRes,
            collectionsRes,
            pagesRes,
            paymentMethodsRes,
            customersRes,
            globalOptionsRes,
            shippingIntRes
        ] = await Promise.all([
            supabase.from('stores_data').select('settings, name').eq('id', storeId).single(),
            supabase.from('products').select('*').eq('store_id', storeId),
            supabase.from('orders').select('*').eq('store_id', storeId),
            supabase.from('transactions').select('*').eq('store_id', storeId),
            supabase.from('suppliers').select('*').eq('store_id', storeId),
            supabase.from('supply_orders').select('*').eq('store_id', storeId),
            supabase.from('reviews').select('*').eq('store_id', storeId),
            supabase.from('abandoned_carts').select('*').eq('store_id', storeId),
            supabase.from('activity_logs').select('*').eq('store_id', storeId),
            supabase.from('employees').select('*, users(full_name, email)').eq('store_id', storeId),
            supabase.from('discount_codes').select('*').eq('store_id', storeId),
            supabase.from('collections').select('*').eq('store_id', storeId),
            supabase.from('custom_pages').select('*').eq('store_id', storeId),
            supabase.from('payment_methods').select('*').eq('store_id', storeId),
            supabase.from('customers').select('*').eq('store_id', storeId),
            supabase.from('global_options').select('*').eq('store_id', storeId),
            supabase.from('shipping_integrations').select('*').eq('store_id', storeId)
        ]);

        if (storeRes.error || !storeRes.data) {
            console.log(`Store ${storeId} not found in relational DB, trying legacy...`);
            const legacyData = await fetchLegacyDocument(storeId);
            // Also check legacy data for products
            if (legacyData && (!legacyData.settings.products || legacyData.settings.products.length === 0) && INITIAL_SETTINGS.products.length > 0) {
                console.log(`No products found in legacy data for store ${storeId}. Seeding from initial settings.`);
                legacyData.settings.products = INITIAL_SETTINGS.products;
            }
            return legacyData;
        }

        // --- Reconstruct Data Types ---

        let products: Product[] = (productsRes.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            stockQuantity: p.stock_quantity,
            ...p.details
        }));
        
        // If no products are found in the database, seed them from the initial settings.
        // This acts as a one-time migration for existing stores.
        if (products.length === 0 && INITIAL_SETTINGS.products.length > 0) {
            console.log(`No products found in DB for store ${storeId}. Seeding from initial settings.`);
            products = INITIAL_SETTINGS.products;
        }

        const orders: Order[] = (ordersRes.data || []).map((o: any) => ({
            id: o.id,
            orderNumber: o.order_number,
            customerName: o.customer_name,
            status: o.status,
            date: o.date,
            ...o.details
        }));

        const transactions: Transaction[] = (transactionsRes.data || []).map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            date: t.date,
            category: t.category,
            note: t.note,
            ...t.details
        }));

        const suppliers: Supplier[] = (suppliersRes.data || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            phone: s.phone,
            address: s.address,
            notes: s.notes
        }));

        const supplyOrders: SupplyOrder[] = (supplyOrdersRes.data || []).map((s: any) => ({
            id: s.id,
            supplierId: s.supplier_id,
            totalCost: s.total_cost,
            date: s.date,
            items: s.items,
            status: s.status
        }));

        const reviews: Review[] = (reviewsRes.data || []).map((r: any) => ({
            id: r.id,
            productId: r.product_id,
            customerName: r.customer_name,
            rating: r.rating,
            comment: r.comment,
            status: r.status,
            date: r.date
        }));

        const abandonedCarts: AbandonedCart[] = (abandonedCartsRes.data || []).map((c: any) => ({
            id: c.id,
            customerName: c.customer_name,
            customerPhone: c.customer_phone,
            totalValue: c.total_value,
            date: c.date,
            items: c.items
        }));

        const activityLogs: ActivityLog[] = (activityLogsRes.data || []).map((l: any) => ({
            id: l.id,
            user: l.user_name,
            action: l.action,
            details: l.details,
            timestamp: l.timestamp,
            date: l.date
        }));

        const employees: Employee[] = (employeesRes.data || []).map((e: any) => ({
            id: e.phone,
            name: e.users?.full_name || 'مستخدم غير معروف',
            email: e.users?.email || 'بريد غير معروف',
            permissions: e.permissions || [],
            status: e.status
        }));

        const discountCodes: DiscountCode[] = (discountsRes.data || []).map((d: any) => ({
            id: d.id,
            code: d.code,
            type: d.type,
            value: d.value,
            active: d.active,
            usageCount: d.usage_count
        }));

        const collections: Collection[] = (collectionsRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            image: c.image
        }));

        const customPages: CustomPage[] = (pagesRes.data || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            content: p.content,
            isActive: p.is_active
        }));

        const paymentMethods: PaymentMethod[] = (paymentMethodsRes.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            details: p.details,
            instructions: p.instructions,
            type: p.type,
            active: p.active,
            logoUrl: p.logo_url
        }));

        const customers: CustomerProfile[] = (customersRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            loyaltyPoints: c.loyalty_points,
            totalSpent: c.total_spent,
            firstOrderDate: c.first_order_date,
            lastOrderDate: c.last_order_date,
            notes: c.notes,
            // derived fields for UI
            totalOrders: c.orders_count || 0,
            successfulOrders: 0, // Should be recalculated from orders if critical
            returnedOrders: 0,
            averageOrderValue: (c.orders_count || 0) > 0 ? c.total_spent / c.orders_count : 0
        }));

        const globalOptions: GlobalOption[] = (globalOptionsRes.data || []).map((g: any) => ({
            id: g.id,
            name: g.name,
            values: g.values || []
        }));

        const shippingIntegrations: ShippingCarrierIntegration[] = (shippingIntRes.data || []).map((s: any) => ({
            id: s.id,
            provider: s.provider,
            apiKey: s.api_key,
            apiSecret: s.api_secret,
            accountNumber: s.account_number,
            isConnected: s.is_connected
        }));

        const fullData: StoreData = {
            settings: {
                ...storeRes.data.settings,
                products: products,
                suppliers: suppliers,
                supplyOrders: supplyOrders,
                reviews: reviews,
                abandonedCarts: abandonedCarts,
                activityLogs: activityLogs,
                employees: employees,
                discountCodes: discountCodes,
                collections: collections,
                customPages: customPages,
                paymentMethods: paymentMethods,
                globalOptions: globalOptions,
                shippingIntegrations: shippingIntegrations
            },
            orders: orders,
            wallet: { 
                balance: 0,
                transactions: transactions 
            },
            cart: [],
            customers: customers
        };

        saveLocal(storeId, fullData);
        return fullData;

    } catch (err) {
        console.error("Error loading relational data:", err);
        const localData = getLocal(storeId);
        // Also check local storage data for products
        if (localData && (!localData.settings.products || localData.settings.products.length === 0) && INITIAL_SETTINGS.products.length > 0) {
            console.log(`No products found in local backup for store ${storeId}. Seeding from initial settings.`);
            localData.settings.products = INITIAL_SETTINGS.products;
        }
        return localData;
    }
};

export const saveStoreData = async (store: Store, data: StoreData): Promise<{ success: boolean, error?: string }> => {
    saveLocal(store.id, data);

    try {
        await ensureStoreRecordExists(store.id, store.name);

        const { 
            products = [], suppliers = [], supplyOrders = [], reviews = [], abandonedCarts = [], activityLogs = [],
            employees = [], discountCodes = [], collections = [], customPages = [], paymentMethods = [],
            globalOptions = [], shippingIntegrations = [],
            ...cleanSettings 
        } = data.settings;
        
        const { orders = [], wallet = { balance: 0, transactions: [] }, customers = [] } = data;
        
        // --- Handle Deletions by Syncing ---
        const syncAndDelete = async (tableName: string, stateItems: any[], dbIdColumn = 'id', stateIdColumn = 'id') => {
            const { data: dbItems, error: fetchError } = await supabase
                .from(tableName)
                .select(dbIdColumn)
                .eq('store_id', store.id);

            if (fetchError) {
                console.error(`Sync Fetch Error on table '${tableName}'. Deletion sync skipped. Error: ${fetchError.message}`);
                return; // Don't throw, just log and continue
            }

            const dbIds = new Set(dbItems.map((item: any) => item[dbIdColumn]));
            const stateIds = new Set(stateItems.map(item => item[stateIdColumn]));
            
            const idsToDelete = [...dbIds].filter(id => !stateIds.has(id));

            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from(tableName)
                    .delete()
                    .eq('store_id', store.id)
                    .in(dbIdColumn, idsToDelete);

                if (deleteError) {
                    console.error(`Sync Delete Error on table '${tableName}'. Some items may not have been deleted. Error: ${deleteError.message}`);
                    // Don't throw
                }
            }
        };

        // Execute all sync operations in parallel before upserting
        await Promise.all([
            syncAndDelete('products', products),
            syncAndDelete('orders', orders),
            syncAndDelete('transactions', wallet.transactions),
            syncAndDelete('suppliers', suppliers),
            syncAndDelete('supply_orders', supplyOrders),
            syncAndDelete('reviews', reviews),
            syncAndDelete('abandoned_carts', abandonedCarts),
            // Activity logs are typically append-only, so no deletion sync.
            syncAndDelete('employees', employees, 'phone', 'id'), // PK is (store_id, phone), state ID is phone
            syncAndDelete('discount_codes', discountCodes),
            syncAndDelete('collections', collections),
            syncAndDelete('custom_pages', customPages),
            syncAndDelete('payment_methods', paymentMethods),
            syncAndDelete('customers', customers),
            syncAndDelete('global_options', globalOptions),
            syncAndDelete('shipping_integrations', shippingIntegrations)
        ]);
        // --- End of Deletion Logic ---

        // --- Handle Upserts ---
        const saveArray = async (table: string, payload: any[], onConflict: string = 'id') => {
            if (payload && payload.length > 0) {
                const uniquePayload = Array.from(new Map(payload.map(item => [String(item.id || `${item.store_id}_${item.phone}`), item])).values());
                if (uniquePayload.length === 0) return;
                const { error } = await supabase.from(table).upsert(uniquePayload, { onConflict });
                if (error) throw new Error(`${table} save failed: ${error.message} - ${JSON.stringify(error.details)}`);
            }
        };

        const productsPayload = products.map(p => {
            const { id, name, sku, price, stockQuantity, ...details } = p;
            return { id, store_id: store.id, name, sku, price, stock_quantity: stockQuantity, details };
        });
        const ordersPayload = orders.map(o => {
            const { id, orderNumber, customerName, status, date, ...details } = o;
            const total_price = o.totalAmountOverride ?? (o.productPrice + o.shippingFee - (o.discount || 0));
            return { id, store_id: store.id, order_number: orderNumber, customer_name: customerName, status, date, total_price, details };
        });
        const transactionsPayload = wallet.transactions.map(t => ({ id: t.id, store_id: store.id, type: t.type, amount: t.amount, date: t.date, category: t.category, note: t.note }));
        const suppliersPayload = suppliers.map(s => ({ ...s, store_id: store.id }));
        const supplyOrdersPayload = supplyOrders.map(so => { const { supplierId, totalCost, ...rest } = so; return { ...rest, store_id: store.id, supplier_id: supplierId, total_cost: totalCost, date: so.date } });
        const reviewsPayload = reviews.map(r => { const { productId, customerName, ...rest } = r; return { ...rest, store_id: store.id, product_id: productId, customer_name: customerName }; });
        const abandonedCartsPayload = abandonedCarts.map(ac => ({ id: ac.id, store_id: store.id, customer_name: ac.customerName, customer_phone: ac.customerPhone, total_value: ac.totalValue, date: ac.date, items: ac.items }));
        const activityLogsPayload = activityLogs.map(al => ({ id: al.id, store_id: store.id, user_name: al.user, action: al.action, details: al.details, timestamp: al.timestamp, date: al.date }));
        const employeesPayload = employees.map(e => ({ store_id: store.id, phone: e.id, permissions: e.permissions, status: e.status }));
        const discountsPayload = discountCodes.map(d => { const { usageCount, ...rest } = d; return { ...rest, store_id: store.id, usage_count: usageCount }; });
        const collectionsPayload = collections.map(c => ({ ...c, store_id: store.id }));
        const pagesPayload = customPages.map(p => { const { isActive, ...rest } = p; return { ...rest, store_id: store.id, is_active: isActive }; });
        const paymentsPayload = paymentMethods.map(p => { const { logoUrl, ...rest } = p; return { ...rest, store_id: store.id, logo_url: logoUrl }; });
        const customersPayload = customers.map(c => ({
            id: c.id, store_id: store.id, name: c.name, phone: c.phone, address: c.address,
            loyalty_points: c.loyaltyPoints, total_spent: c.totalSpent,
            first_order_date: c.firstOrderDate, last_order_date: c.lastOrderDate, notes: c.notes
        }));
        const globalOptionsPayload = globalOptions.map(g => ({ ...g, store_id: store.id }));
        const shippingIntegrationsPayload = shippingIntegrations.map(si => { const { apiKey, apiSecret, accountNumber, isConnected, ...rest } = si; return { ...rest, store_id: store.id, api_key: apiKey, api_secret: apiSecret, account_number: accountNumber, is_connected: isConnected }; });
        
        await Promise.all([
            saveArray('products', productsPayload),
            saveArray('orders', ordersPayload),
            saveArray('transactions', transactionsPayload),
            saveArray('suppliers', suppliersPayload),
            saveArray('supply_orders', supplyOrdersPayload),
            saveArray('reviews', reviewsPayload),
            saveArray('abandoned_carts', abandonedCartsPayload),
            saveArray('activity_logs', activityLogsPayload),
            saveArray('employees', employeesPayload, 'store_id,phone'),
            saveArray('discount_codes', discountsPayload),
            saveArray('collections', collectionsPayload),
            saveArray('custom_pages', pagesPayload),
            saveArray('payment_methods', paymentsPayload),
            saveArray('customers', customersPayload),
            saveArray('global_options', globalOptionsPayload),
            saveArray('shipping_integrations', shippingIntegrationsPayload)
        ]);
        
        const { error: storeError } = await supabase
            .from('stores_data')
            .update({ settings: cleanSettings, name: store.name })
            .eq('id', store.id);
        if (storeError) throw storeError;

        console.log(`Successfully saved all relational data for store ${store.id}`);
        return { success: true };
    } catch (err: any) {
        console.error(`Failed to save relational data for store ${store.id}:`, err);
        return { success: false, error: err.message };
    }
};

export const getGlobalData = async (): Promise<{ users: User[], loyaltyData: any } | null> => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*');

        if (error) {
            console.error("Error fetching users from Supabase:", error);
            throw error;
        }

        if (!data) {
            console.log('No users found, trying local storage.');
            return getLocal('global');
        }

        const users: User[] = data.map((u: any) => ({
            fullName: u.full_name,
            phone: u.phone,
            password: u.password,
            email: u.email,
            stores: u.stores,
            sites: u.sites,
            isAdmin: u.is_admin,
            isBanned: u.is_banned,
            joinDate: u.join_date,
        }));
        
        const globalData = { users, loyaltyData: {} };
        saveLocal('global', globalData);
        return globalData;

    } catch (err) {
        console.error("Error fetching global data:", err);
        return getLocal('global');
    }
};

export const saveGlobalData = async (data: { users: User[], loyaltyData: any }): Promise<{ success: boolean, error?: string }> => {
    saveLocal('global', data);
    try {
        const usersToUpsert = data.users.map(u => ({
            phone: u.phone,
            full_name: u.fullName,
            password: u.password,
            email: u.email,
            stores: u.stores,
            sites: u.sites,
            is_admin: u.isAdmin || false,
            is_banned: u.isBanned || false,
            join_date: u.joinDate
        }));

        const { error } = await supabase
            .from('users')
            .upsert(usersToUpsert, { onConflict: 'phone' });
        
        if (error) {
            console.error("Error upserting users to Supabase:", error);
            throw error;
        }
        return { success: true };
    } catch (err: any) {
        console.error("Error saving global data:", err);
        return { success: false, error: err.message };
    }
};

// FIX: Implement clearStoreData to resolve export error.
export const clearStoreData = async (storeId: string, targets: string[]): Promise<{ success: boolean, error?: string }> => {
    try {
        const tablesToDeleteFrom = targets.map(target => {
            switch (target) {
                case 'orders': return 'orders';
                case 'products': return 'products';
                case 'customers': return 'customers';
                case 'wallet': return 'transactions';
                case 'activity': return 'activity_logs';
                case 'settings': return ['discount_codes', 'reviews', 'abandoned_carts', 'global_options', 'custom_pages', 'payment_methods', 'collections'];
                default: return null;
            }
        }).flat().filter(Boolean) as string[];

        for (const table of tablesToDeleteFrom) {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('store_id', storeId);
            if (error) throw new Error(`Failed to clear table ${table}: ${error.message}`);
        }
        
        if (targets.includes('settings')) {
            const { error } = await supabase
                .from('stores_data')
                .update({ settings: INITIAL_SETTINGS })
                .eq('id', storeId);
            if (error) throw error;
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

// FIX: Implement migrateAllLegacyDataToRelational to resolve export error.
export const migrateAllLegacyDataToRelational = async (users: User[]): Promise<{ success: boolean, summary: string, error?: string }> => {
    let summaryLog: string[] = [];
    try {
        summaryLog.push(`Starting migration for ${users.length} users.`);

        const usersToUpsert = users.map(u => {
            const { stores, sites, ...userMetadata } = u;
            return {
                id: u.phone,
                email: u.email,
                user_metadata: userMetadata
            };
        });

        for (const user of users) {
            if (!user.stores) continue;
            for (const store of user.stores) {
                summaryLog.push(`-- Processing store: ${store.name} (${store.id})`);
                const legacyData = await fetchLegacyDocument(store.id);
                if (legacyData) {
                    const { success, error } = await saveStoreData(store, legacyData);
                    if (!success) {
                        summaryLog.push(`--- FAILED to migrate data for store ${store.id}: ${error}`);
                    } else {
                        summaryLog.push(`--- Successfully migrated data for store ${store.id}.`);
                    }
                } else {
                    summaryLog.push(`--- No legacy data found for store ${store.id}, skipping.`);
                }
            }
        }
        
        return { success: true, summary: summaryLog.join('\n') };

    } catch (err: any) {
        summaryLog.push(`\n** MIGRATION FAILED **: ${err.message}`);
        return { success: false, summary: summaryLog.join('\n'), error: err.message };
    }
};