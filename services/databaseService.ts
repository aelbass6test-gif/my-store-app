import { db } from './firebaseClient';
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    deleteDoc, 
    query, 
    where, 
    getDocFromServer,
    updateDoc
} from 'firebase/firestore';
import { 
    Store, 
    StoreData, 
    User, 
    Product, 
    Order, 
    Transaction, 
    Supplier, 
    SupplyOrder, 
    Review, 
    AbandonedCart, 
    ActivityLog, 
    Employee, 
    DiscountCode, 
    Collection, 
    CustomPage, 
    PaymentMethod, 
    CustomerProfile, 
    GlobalOption, 
    ShippingCarrierIntegration 
} from '../types';
import { INITIAL_SETTINGS } from '../constants';

const LOCAL_STORAGE_PREFIX = 'wuilt_backup_';

// --- Error Handling & Metrics ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('currentUserPhone') || null,
      email: null,
      emailVerified: null,
      isAnonymous: null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Recursively traverse and clean up any undefined properties for Firestore safety
export function cleanUndefined<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return null as any;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item)) as any;
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            const val = (obj as any)[key];
            if (val !== undefined) {
                result[key] = cleanUndefined(val);
            }
        }
        return result;
    }
    return obj;
}

// Check connection to Firestore (mandatory on initial boot)
export const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
        await getDocFromServer(doc(db, 'stores_data', 'connection_test'));
        return true;
    } catch (error: any) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration or network status.");
        }
        return false;
    }
};

// --- Backward Compatibility Placeholders for Restriction Alerts ---
export const getSupabaseRestrictedStatus = (): boolean => false;
export const setSupabaseRestricted = (restricted: boolean) => {};
export const isRestrictionError = (error: any): boolean => false;

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
        localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(data));
    } catch (e) {
        console.warn(`LocalStorage backup failed for key '${key}'. Reliance on the primary Firebase database will continue.`, e);
    }
};

export const ensureStoreRecordExists = async (storeId: string, storeName: string): Promise<{ success: boolean, error?: string }> => {
    try {
        const storeRef = doc(db, 'stores_data', storeId);
        await setDoc(storeRef, { id: storeId, name: storeName }, { merge: true });
        return { success: true };
    } catch (err: any) {
        console.error("Failed to ensure store record exists:", err);
        return { success: false, error: err.message };
    }
};

// --- Relational Data Functions using Firestore ---

export const getStoreData = async (storeId: string): Promise<StoreData | null> => {
    try {
        // Fetch static settings
        const storeSnap = await getDoc(doc(db, 'stores_data', storeId)).catch(err => {
            handleFirestoreError(err, OperationType.GET, `stores_data/${storeId}`);
            throw err;
        });

        // Safe fetch collections with storeId filtering
        const fetchCollection = async <T>(collectionName: string): Promise<T[]> => {
            try {
                let snap = await getDocs(query(collection(db, collectionName), where('storeId', '==', storeId)));
                let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                if (items.length === 0) {
                    const snap_snake = await getDocs(query(collection(db, collectionName), where('store_id', '==', storeId)));
                    items = snap_snake.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                }
                return items;
            } catch (err) {
                handleFirestoreError(err, OperationType.LIST, collectionName);
                return [];
            }
        };

        const [
            products,
            orders,
            transactions,
            suppliers,
            supplyOrders,
            reviews,
            abandonedCarts,
            activityLogs,
            employees,
            discountCodes,
            collectionsList,
            customPages,
            paymentMethods,
            customers,
            globalOptions,
            shippingIntegrations
        ] = await Promise.all([
            fetchCollection<Product>('products'),
            fetchCollection<Order>('orders'),
            fetchCollection<Transaction>('transactions'),
            fetchCollection<Supplier>('suppliers'),
            fetchCollection<SupplyOrder>('supply_orders'),
            fetchCollection<Review>('reviews'),
            fetchCollection<AbandonedCart>('abandoned_carts'),
            fetchCollection<ActivityLog>('activity_logs'),
            fetchCollection<Employee>('employees'),
            fetchCollection<DiscountCode>('discount_codes'),
            fetchCollection<Collection>('collections'),
            fetchCollection<CustomPage>('custom_pages'),
            fetchCollection<PaymentMethod>('payment_methods'),
            fetchCollection<CustomerProfile>('customers'),
            fetchCollection<GlobalOption>('global_options'),
            fetchCollection<ShippingCarrierIntegration>('shipping_integrations')
        ]);

        const storeSettings = storeSnap.exists() ? (storeSnap.data().settings || {}) : {};
        const storeName = storeSnap.exists() ? (storeSnap.data().name || '') : '';

        // Products seeding fallback for new database
        let finalProducts = products;
        if (finalProducts.length === 0 && INITIAL_SETTINGS.products.length > 0) {
            finalProducts = INITIAL_SETTINGS.products;
        }

        const walletSettingsObj = storeSettings.wallet_settings;
        const withdrawRequestsArr = storeSettings.withdraw_requests || [];
        const supplyBalanceNum = storeSettings.supply_balance || 0;

        const fullData: StoreData = {
            settings: {
                ...INITIAL_SETTINGS,
                ...storeSettings,
                products: finalProducts,
                suppliers: suppliers,
                supplyOrders: supplyOrders,
                reviews: reviews,
                abandonedCarts: abandonedCarts,
                activityLogs: activityLogs,
                employees: employees,
                discountCodes: discountCodes,
                collections: collectionsList,
                customPages: customPages,
                paymentMethods: paymentMethods,
                globalOptions: globalOptions,
                shippingIntegrations: shippingIntegrations
            },
            orders: orders,
            wallet: { 
                balance: 0,
                supplyBalance: supplyBalanceNum,
                transactions: transactions,
                settings: walletSettingsObj,
                withdrawRequests: withdrawRequestsArr
            },
            cart: [],
            customers: customers
        };

        saveLocal(storeId, fullData);
        return fullData;

    } catch (err: any) {
        console.error("Error loading relational data:", err);
        return getLocal(storeId);
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

        const cleanSettingsFinal = cleanUndefined({
            ...cleanSettings,
            wallet_settings: wallet.settings || null,
            withdraw_requests: wallet.withdrawRequests || [],
            supply_balance: wallet.supplyBalance || 0
        });

        // --- Deletion & Synchronization logic ---
        const syncCollection = async (collectionName: string, stateItems: any[], idField = 'id') => {
            try {
                let snap = await getDocs(query(collection(db, collectionName), where('storeId', '==', store.id)));
                if (snap.empty) {
                    snap = await getDocs(query(collection(db, collectionName), where('store_id', '==', store.id)));
                }
                
                const existingDbDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const stateIds = new Set(stateItems.map(item => String(item[idField] || `${store.id}_${item.phone}`)));

                // 1. Delete items not present in incoming state
                const deletePromises = snap.docs
                    .filter(doc => !stateIds.has(doc.id))
                    .map(doc => deleteDoc(doc.ref).catch(err => handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${doc.id}`)));
                
                await Promise.all(deletePromises);

                // 2. Put / Upsert items in state 
                const upsertPromises = stateItems.map(async (item) => {
                    const docId = String(item[idField] || `${store.id}_${item.phone}`);
                    const docRef = doc(db, collectionName, docId);
                    
                    const payload = cleanUndefined({ 
                        ...item, 
                        storeId: store.id,
                        store_id: store.id 
                    });
                    await setDoc(docRef, payload, { merge: true }).catch(err => {
                        handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
                    });
                });

                await Promise.all(upsertPromises);
            } catch (err) {
                console.error(`Error syncing collection ${collectionName}:`, err);
            }
        };

        // Parallel processing of all synchronization targets
        await Promise.all([
            syncCollection('products', products),
            syncCollection('orders', orders),
            syncCollection('transactions', wallet.transactions),
            syncCollection('suppliers', suppliers),
            syncCollection('supply_orders', supplyOrders),
            syncCollection('reviews', reviews),
            syncCollection('abandoned_carts', abandonedCarts),
            syncCollection('employees', employees, 'phone'),
            syncCollection('discount_codes', discountCodes),
            syncCollection('collections', collections),
            syncCollection('custom_pages', customPages),
            syncCollection('payment_methods', paymentMethods),
            syncCollection('customers', customers),
            syncCollection('global_options', globalOptions),
            syncCollection('shipping_integrations', shippingIntegrations)
        ]);

        // Save store general settings meta record
        const storeRef = doc(db, 'stores_data', store.id);
        const storePayload = cleanUndefined({ settings: cleanSettingsFinal, name: store.name });
        await setDoc(storeRef, storePayload, { merge: true }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, `stores_data/${store.id}`);
            throw err;
        });

        console.log(`Successfully saved and synced to Firebase for store ${store.id}`);
        return { success: true };

    } catch (err: any) {
        console.error(`Failed to save store data to Firebase:`, err);
        return { success: false, error: err.message };
    }
};

export const getGlobalData = async (): Promise<{ users: User[], loyaltyData: any } | null> => {
    try {
        const queryUsers = collection(db, 'users');
        const snap = await getDocs(queryUsers).catch(err => {
            handleFirestoreError(err, OperationType.LIST, 'users');
            throw err;
        });

        const dbUsers: User[] = snap.docs.map(doc => {
            const data = doc.data();
            return {
                fullName: data.fullName || '',
                phone: doc.id,
                password: data.password || '',
                email: data.email || '',
                stores: data.stores || [],
                sites: data.sites || [],
                isAdmin: data.isAdmin || false,
                isBanned: data.isBanned || false,
                joinDate: data.joinDate || ''
            };
        });

        const localGlobal = getLocal('global');
        const localUsers: User[] = localGlobal?.users || [];

        // Dual-merge to prevent lock-outs when swapping to a fresh cloud instance
        const mergedUsersMap = new Map<string, User>();
        localUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });
        dbUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });

        const finalUsers = Array.from(mergedUsersMap.values());

        // Perform migration upsert if local users don't exist in the database
        const needsUpload = finalUsers.some(fu => !dbUsers.some(du => du.phone === fu.phone));
        if (needsUpload && finalUsers.length > 0) {
            console.log(`[MIGRATION] Migrating local users to Firestore...`);
            const migrationPromises = finalUsers.map(async (u) => {
                const userRef = doc(db, 'users', u.phone);
                const userPayload = cleanUndefined({
                    fullName: u.fullName,
                    password: u.password,
                    email: u.email,
                    stores: u.stores || [],
                    sites: u.sites || [],
                    isAdmin: u.isAdmin || false,
                    isBanned: u.isBanned || false,
                    joinDate: u.joinDate
                });
                await setDoc(userRef, userPayload, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.phone}`));
            });
            await Promise.all(migrationPromises);
        }

        const globalData = { users: finalUsers, loyaltyData: {} };
        saveLocal('global', globalData);
        return globalData;

    } catch (err: any) {
        console.error("Error fetching global data from Firestore:", err);
        return getLocal('global');
    }
};

export const saveGlobalData = async (data: { users: User[], loyaltyData: any }): Promise<{ success: boolean, error?: string }> => {
    saveLocal('global', data);
    try {
        const savePromises = data.users.map(async (u) => {
            if (!u.phone) return;
            const userRef = doc(db, 'users', u.phone);
            const userPayload = cleanUndefined({
                fullName: u.fullName,
                password: u.password,
                email: u.email,
                stores: u.stores || [],
                sites: u.sites || [],
                isAdmin: u.isAdmin || false,
                isBanned: u.isBanned || false,
                joinDate: u.joinDate || ''
            });
            await setDoc(userRef, userPayload, { merge: true }).catch(err => {
                handleFirestoreError(err, OperationType.WRITE, `users/${u.phone}`);
            });
        });

        await Promise.all(savePromises);
        return { success: true };
    } catch (err: any) {
        console.error("Error saving global data to Firestore:", err);
        return { success: false, error: err.message };
    }
};

export const clearStoreData = async (storeId: string, targets: string[]): Promise<{ success: boolean, error?: string }> => {
    try {
        const collectionsToClear = targets.map(target => {
            switch (target) {
                case 'orders': return ['orders'];
                case 'products': return ['products'];
                case 'customers': return ['customers'];
                case 'wallet': return ['transactions'];
                case 'activity': return ['activity_logs'];
                case 'coupons': return ['discount_codes'];
                case 'reviews': return ['reviews'];
                case 'abandoned_carts': return ['abandoned_carts'];
                case 'shipping': return ['shipping_integrations'];
                case 'pages': return ['custom_pages'];
                case 'suppliers': return ['suppliers'];
                case 'supply_orders': return ['supply_orders'];
                case 'global_options': return ['global_options'];
                case 'payment_methods': return ['payment_methods'];
                case 'collections': return ['collections'];
                case 'employees': return ['employees'];
                case 'settings': return [
                    'discount_codes', 'reviews', 'abandoned_carts', 'global_options', 
                    'custom_pages', 'payment_methods', 'collections', 'suppliers', 
                    'supply_orders', 'shipping_integrations'
                ];
                default: return [];
            }
        }).flat();

        const clearPromises = collectionsToClear.map(async (colName) => {
            const q = query(collection(db, colName), where('storeId', '==', storeId));
            const snap = await getDocs(q);
            const deleteDocs = snap.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteDocs);
        });

        await Promise.all(clearPromises);

        // Reset partner and wallet metrics
        if (targets.includes('partner_withdrawals')) {
            const storeRef = doc(db, 'stores_data', storeId);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists()) {
                const settings = storeSnap.data().settings || {};
                const updatedSettings = {
                    ...settings,
                    partnerTransactions: [],
                    withdraw_requests: [],
                    supply_balance: 0
                };
                await updateDoc(storeRef, { settings: updatedSettings });
            }
        }

        if (targets.includes('settings')) {
            const storeRef = doc(db, 'stores_data', storeId);
            await updateDoc(storeRef, { settings: INITIAL_SETTINGS });
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const migrateAllLegacyDataToRelational = async (users: User[]): Promise<{ success: boolean, summary: string, error?: string }> => {
    let summaryLog: string[] = [];
    try {
        summaryLog.push(`Starting migration for ${users.length} users into Firestore.`);
        // Legacy stores are already backup formats, save directly to Firestore
        for (const user of users) {
            if (!user.stores) continue;
            for (const store of user.stores) {
                summaryLog.push(`-- Processing store: ${store.name} (${store.id})`);
                const legacyData = getLocal(store.id);
                if (legacyData) {
                    const { success, error } = await saveStoreData(store, legacyData);
                    if (!success) {
                        summaryLog.push(`--- FAILED to migrate store ${store.id}: ${error}`);
                    } else {
                        summaryLog.push(`--- Successfully migrated store ${store.id}.`);
                    }
                } else {
                    summaryLog.push(`--- No local data found for store ${store.id}, skipping.`);
                }
            }
        }
        return { success: true, summary: summaryLog.join('\n') };
    } catch (err: any) {
        summaryLog.push(`\n** MIGRATION FAILED **: ${err.message}`);
        return { success: false, summary: summaryLog.join('\n'), error: err.message };
    }
};
