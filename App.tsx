import { useState, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Outlet, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';

import { User, Store, StoreData, Order, Settings, Wallet, OrderItem, Employee, Product, PlaceOrderData } from './types';
import * as db from './services/databaseService';
import { supabase } from './services/supabaseClient';
import { INITIAL_SETTINGS } from './constants';
import GlobalSaveIndicator, { SaveStatus } from './components/GlobalSaveIndicator';
import { oneToolzProducts } from './src/data/one-toolz-products';

// Page Components
import SignUpPage from './components/SignUpPage';
import EmployeeLoginPage from './components/EmployeeLoginPage';
import CreateStorePage from './components/CreateStorePage';
import ManageSitesPage from './components/ManageSitesPage';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OrdersList from './components/OrdersList';
import ProductsPage from './components/ProductsPage';
import CustomersPage from './components/CustomersPage';
import WalletPage from './components/WalletPage';
import SettingsPage from './components/SettingsPage';
import StorefrontPage from './components/StorefrontPage';
import CheckoutPage from './components/CheckoutPage';
import OrderSuccessPage from './components/OrderSuccessPage';
import StoreCustomizationPage from './components/StoreCustomizationPage';
import ShippingPage from './components/ShippingPage';
import ConfirmationQueuePage from './components/ConfirmationQueuePage';
import AbandonedCartsPage from './components/AbandonedCartsPage';
import DiscountsPage from './components/DiscountsPage';
import ReviewsPage from './components/ReviewsPage';
import CollectionsPage from './components/CollectionsPage';
import ProductOptionsPage from './components/ProductOptionsPage';
import ExpensesPage from './components/ExpensesPage';
import MarketingPage from './components/MarketingPage';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import EmployeeLayout from './components/EmployeeLayout';
import EmployeeDashboardPage from './components/EmployeeDashboardPage';
import EmployeeAccountSettingsPage from './components/EmployeeAccountSettingsPage';
import EmployeeActivityPage from './components/EmployeeActivityPage';
import AccountSettingsPage from './components/AccountSettingsPage';
import CollectionsReportPage from './components/CollectionsReportPage';
import ActivityLogsPage from './components/ActivityLogsPage';
import SuppliersPage from './components/SuppliersPage';
import PagesManager from './components/PagesManager';
import PaymentSettingsPage from './components/PaymentSettingsPage';
import TeamChatPage from './components/TeamChatPage';
import WhatsAppPage from './components/WhatsAppPage';
import GlobalLoader from './components/GlobalLoader';
import EmployeesPage from './components/EmployeesPage';
import ReportsPage from './components/ReportsPage';
import CongratsModal from './components/CongratsModal';
import OtpVerificationPage from './components/OtpVerificationPage';
import ComingSoonPage from './components/ComingSoonPage';

// --- Layouts ---
const MainLayout = ({ currentUser, handleLogout, isSidebarOpen, setSidebarOpen, activeStore, theme, setTheme }: any) => {
    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-gradient-to-b dark:from-slate-950 dark:to-[#111827] text-slate-800 dark:text-slate-200" dir="rtl">
            <Header currentUser={currentUser} onLogout={handleLogout} onToggleSidebar={() => setSidebarOpen(true)} theme={theme} setTheme={setTheme} />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar activeStore={activeStore} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

// --- Helpers ---
function sanitizeData(storeData: StoreData): StoreData {
    if (!storeData) return storeData;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    let hasChanges = false;

    const fixDate = (dateString: string): string | null => {
        if (!dateString || typeof dateString !== 'string') return null;
        if (isoDateRegex.test(dateString)) return null;
        const parsedDate = new Date(dateString);
        if (isNaN(parsedDate.getTime()) || /[٠-٩]/.test(dateString)) {
            hasChanges = true;
            return new Date().toISOString();
        }
        hasChanges = true;
        return parsedDate.toISOString();
    };
    
    const sanitizedTransactions = storeData.wallet?.transactions?.map(tx => {
        const fixedDate = fixDate(tx.date);
        return fixedDate ? { ...tx, date: fixedDate } : tx;
    });

    const sanitizedOrders = storeData.orders?.map(order => {
        const fixedDate = fixDate(order.date);
        return fixedDate ? { ...order, date: fixedDate } : order;
    });

    if (hasChanges) {
        return {
            ...storeData,
            wallet: { ...(storeData.wallet || {balance: 0, transactions: []}), transactions: sanitizedTransactions || storeData.wallet?.transactions || [] },
            orders: sanitizedOrders || storeData.orders || [],
        };
    }
    return storeData;
}

export const AppComponent = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [allStoresData, setAllStoresData] = useState<Record<string, StoreData>>({});
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
    const [authChecked, setAuthChecked] = useState<boolean>(false);
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const [isEmployeeSession, setIsEmployeeSession] = useState<boolean>(false);
    const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'system');
    const [showCongratsModal, setShowCongratsModal] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [saveMessage, setSaveMessage] = useState('');
    const [welcomeScreenShown, setWelcomeScreenShown] = useState<boolean>(false);
    
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    const isRefreshing = useRef(false);
    const navigate = useNavigate();

    const activeStore = useMemo(() => {
        if (!activeStoreId) return undefined;
        const owner = users.find(u => u.stores?.some(s => s.id === activeStoreId));
        return owner?.stores?.find(s => s.id === activeStoreId);
    }, [activeStoreId, users]);

    // --- Auto-Save Logic ---
    useEffect(() => {
        if (isInitialLoad) return;
        if (isRefreshing.current) {
            isRefreshing.current = false;
            return;
        }

        if (saveStatus === 'success' || saveStatus === 'idle' || saveStatus === 'error') {
            setSaveStatus('pending');
            setSaveMessage('تغييرات غير محفوظة...');
        }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            setSaveStatus('saving');
            setSaveMessage('جاري الحفظ...');
            try {
                await db.saveGlobalData({ users, loyaltyData: {} });
                if (activeStoreId && allStoresData[activeStoreId] && activeStore) {
                    const { success, error } = await db.saveStoreData(activeStore, allStoresData[activeStoreId]);
                    if (!success) throw new Error(error || 'فشل حفظ بيانات المتجر');
                }
                setSaveStatus('success');
                setSaveMessage('تم الحفظ بنجاح!');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (e: any) {
                setSaveStatus('error');
                setSaveMessage(e.message || 'فشل الحفظ');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        }, 2500);

        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [users, allStoresData, activeStore, activeStoreId, isInitialLoad]);

    // --- Realtime Refresh (Anti-Flicker) ---
    const refreshStoreData = (storeId: string) => {
        // إذا كان التطبيق يقوم بالحفظ الآن، نتجاهل إشارة التحديث من السيرفر لمنع الرعشة
        if (saveStatus === 'saving' || saveStatus === 'success') {
            return;
        }

        if (!storeId || storeId !== activeStoreId) return;

        if (refreshDebounceTimers.current[storeId]) {
            clearTimeout(refreshDebounceTimers.current[storeId]!);
        }

        refreshDebounceTimers.current[storeId] = setTimeout(async () => {
            const storeData = await db.getStoreData(storeId) as StoreData | null;
            if (storeData) {
                const sanitizedStoreData = sanitizeData(storeData);
                setAllStoresData(prev => {
                    // فحص ذكي: إذا لم تتغير البيانات، لا نقوم بتحديث الـ State
                    if (JSON.stringify(prev[storeId]) === JSON.stringify(sanitizedStoreData)) {
                        return prev;
                    }
                    isRefreshing.current = true;
                    return { ...prev, [storeId]: sanitizedStoreData };
                });
            }
            refreshDebounceTimers.current[storeId] = null;
        }, 1500);
    };

    const refreshGlobalData = () => {
        const key = 'global';
        if (refreshDebounceTimers.current[key]) clearTimeout(refreshDebounceTimers.current[key]!);
        refreshDebounceTimers.current[key] = setTimeout(async () => {
            const globalData = await db.getGlobalData();
            if (globalData?.users) {
                isRefreshing.current = true;
                setUsers(globalData.users);
            }
            refreshDebounceTimers.current[key] = null;
        }, 1500);
    };

    useEffect(() => {
        const subscriptions = [
            supabase.channel('public:orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => refreshStoreData(p.new?.store_id || p.old?.store_id)).subscribe(),
            supabase.channel('public:stores_data').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores_data' }, (p) => refreshStoreData(p.new?.id)).subscribe(),
            supabase.channel('public:users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refreshGlobalData).subscribe()
        ];
        return () => { subscriptions.forEach(sub => supabase.removeChannel(sub)); };
    }, [activeStoreId, saveStatus]);

    const handleLogout = () => {
        setCurrentUser(null);
        setActiveStoreId(null);
        localStorage.clear();
        navigate('/owner-login');
    };

    const pageProps = {
        users, setUsers, allStoresData, setAllStoresData, currentUser, activeStore,
        orders: activeStoreId ? allStoresData[activeStoreId]?.orders || [] : [],
        settings: activeStoreId ? allStoresData[activeStoreId]?.settings || INITIAL_SETTINGS : INITIAL_SETTINGS,
        wallet: activeStoreId ? allStoresData[activeStoreId]?.wallet || { balance: 0, transactions: [] } : { balance: 0, transactions: [] },
        cart,
        setOrders: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const current = p[activeStoreId]?.orders || [];
                    const next = typeof updater === 'function' ? updater(current) : updater;
                    if (current === next) return p;
                    return { ...p, [activeStoreId]: { ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }), orders: next } };
                });
            }
        },
        setSettings: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const current = p[activeStoreId]?.settings || INITIAL_SETTINGS;
                    const next = typeof updater === 'function' ? updater(current) : updater;
                    if (current === next) return p;
                    return { ...p, [activeStoreId]: { ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }), settings: next } };
                });
            }
        },
    };

    // --- Initialization ---
    useEffect(() => {
        const load = async () => {
            try {
                const global = await db.getGlobalData();
                const loadedUsers = global?.users || [];
                setUsers(loadedUsers);
                const savedPhone = localStorage.getItem('currentUserPhone');
                if (savedPhone) {
                    const user = loadedUsers.find((u: any) => u.phone === savedPhone);
                    if (user) {
                        setCurrentUser(user);
                        const storeId = localStorage.getItem('lastActiveStoreId') || user.stores?.[0]?.id;
                        if (storeId) {
                            setActiveStoreId(storeId);
                            const data = await db.getStoreData(storeId);
                            if (data) setAllStoresData({ [storeId]: sanitizeData(data as StoreData) });
                        }
                    }
                }
            } finally { setAuthChecked(true); setIsInitialLoad(false); }
        };
        load();
    }, []);

    if (!authChecked) return <GlobalLoader />;

    return (
        <>
            <Routes>
                <Route path="/" element={<MainLayout currentUser={currentUser} handleLogout={handleLogout} activeStore={activeStore} theme={theme} setTheme={setTheme} />}>
                    <Route index element={<Dashboard {...pageProps} />} />
                    <Route path="orders" element={<OrdersList {...pageProps} />} />
                    <Route path="products" element={<ProductsPage {...pageProps} />} />
                    <Route path="customers" element={<CustomersPage {...pageProps} />} />
                    <Route path="settings" element={<SettingsPage {...pageProps} />} />
                    <Route path="wallet" element={<WalletPage {...pageProps} />} />
                </Route>
                <Route path="/owner-login" element={<SignUpPage onLoginSuccess={() => navigate('/')} />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <GlobalSaveIndicator status={saveStatus} message={saveMessage} />
        </>
    );
};

export const AppWrapper = () => (
    <HashRouter>
        <AppComponent />
    </HashRouter>
);

export default AppWrapper;
