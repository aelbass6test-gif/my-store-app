




import { useState, useMemo, useEffect, useRef } from 'react';
// FIX: The `Navigate` component was not imported, causing an error. It has been added to the import statement.
import { HashRouter, Routes, Route, Outlet, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';

import { User, Store, StoreData, Order, Settings, Wallet, OrderItem, Employee, Product, PlaceOrderData } from './types';
import * as db from './services/databaseService';
import { supabase } from './services/supabaseClient';
import { INITIAL_SETTINGS } from './constants';
import GlobalSaveIndicator, { SaveStatus } from './components/GlobalSaveIndicator';
import { oneToolzProducts } from './src/data/one-toolz-products';

// Page Components (will be loaded via router)
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
// FIX: AdminPage is a default export, so it should be imported as such.
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
import WelcomeLoader from './components/WelcomeLoader';
import GlobalLoader from './components/GlobalLoader';
import EmployeesPage from './components/EmployeesPage';
import ReportsPage from './components/ReportsPage';
import ChatBot from './components/ChatBot';
import CongratsModal from './components/CongratsModal';
import OrderTrackingPage from './components/OrderTrackingPage';
import OtpVerificationPage from './components/OtpVerificationPage';
import IosInstallPrompt from './components/IosInstallPrompt';
import ComingSoonPage from './components/ComingSoonPage';

interface EmployeeRegisterRequestData {
  fullName: string;
  phone: string;
  password: string;
  storeId: string;
  email: string;
}

// FIX: This component was defined after its usage in the routes array, causing an error.
// It has been converted to a React component and is now defined before use.
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

const AdminLayout = ({ currentUser, handleLogout, theme, setTheme }: any) => (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200" dir="rtl">
        <Header currentUser={currentUser} onLogout={handleLogout} theme={theme} setTheme={setTheme} onToggleSidebar={() => {}} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
        </main>
    </div>
);

const EmployeeLayoutWrapper = ({ children, ...props }: any) => {
    return <EmployeeLayout {...props}>{children}</EmployeeLayout>;
};

function sanitizeData(storeData: StoreData): StoreData {
    if (!storeData) return storeData;

    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/; // Simplified check for ISO format
    let hasChanges = false;

    const fixDate = (dateString: string): string | null => {
        if (!dateString || typeof dateString !== 'string') return null;

        // If it's already in a valid ISO-like format, do nothing.
        if (isoDateRegex.test(dateString)) {
            return null;
        }
        
        // Attempt to parse it. This will fail for non-standard formats like the Arabic locale one.
        const parsedDate = new Date(dateString);

        // If parsing fails OR if it contains Arabic numerals (a strong sign of the old bug), it's corrupted.
        if (isNaN(parsedDate.getTime()) || /[٠-٩]/.test(dateString)) {
            console.warn(`Found and fixed corrupted date format: "${dateString}". Replacing with current time.`);
            hasChanges = true;
            // We replace it with the current time to ensure data integrity, even if the original time is lost.
            return new Date().toISOString();
        } else {
            // The date was parsable but not in ISO format (e.g., "2024-01-01"). Convert it to full ISO format.
            console.log(`Normalized date format from "${dateString}" to ISO format.`);
            hasChanges = true;
            return parsedDate.toISOString();
        }
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
            wallet: {
                ...(storeData.wallet || {balance: 0, transactions: []}),
                transactions: sanitizedTransactions || storeData.wallet?.transactions || []
            },
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
    const [welcomeScreenShown, setWelcomeScreenShown] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [saveMessage, setSaveMessage] = useState('');
    // FIX: Replaced `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` for browser compatibility. `NodeJS.Timeout` is a Node.js specific type and is not available in the browser environment.
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    const isRefreshing = useRef(false);
    
    // 2FA State
    const [userForOtp, setUserForOtp] = useState<User | null>(null);
    const [sessionInfoForOtp, setSessionInfoForOtp] = useState<{isEmployee: boolean, storeId: string} | null>(null);
    const [otpError, setOtpError] = useState<string>('');

    // PWA Install State
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
    const [isIos, setIsIos] = useState(false);
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
            console.log('[AUTO-SAVE] Skipped save because a refresh just occurred.');
            isRefreshing.current = false; // Reset flag and skip this cycle
            return;
        }

        // A change occurred. Indicate that there are unsaved changes.
        // Don't change status if it's already saving or pending.
        if (saveStatus === 'success' || saveStatus === 'idle' || saveStatus === 'error') {
            setSaveStatus('pending');
            setSaveMessage('تغييرات غير محفوظة...');
        }

        // Clear previous debounce timer to reset the countdown
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Set a new timer to perform the save after a period of inactivity
        debounceTimer.current = setTimeout(async () => {
            setSaveStatus('saving');
            setSaveMessage('جاري الحفظ...');

            try {
                // Save global data (users)
                await db.saveGlobalData({ users, loyaltyData: {} });

                // Save active store data
                if (activeStoreId && allStoresData[activeStoreId] && activeStore) {
                    const { success, error } = await db.saveStoreData(activeStore, allStoresData[activeStoreId]);
                    if (!success) {
                        throw new Error(error || 'فشل حفظ بيانات المتجر');
                    }
                }
                
                setSaveStatus('success');
                setSaveMessage('تم الحفظ بنجاح!');
                setTimeout(() => setSaveStatus('idle'), 2000);

            } catch (e: any) {
                setSaveStatus('error');
                setSaveMessage(e.message || 'فشل الحفظ');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        }, 2500); // 2.5-second debounce period

        // Cleanup function to clear timer on component unmount or before next effect run
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [users, allStoresData, activeStore, activeStoreId, isInitialLoad]);


    useEffect(() => {
        const applyTheme = () => {
            const themeToApply = theme === 'system' 
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : theme;

            if (themeToApply === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };
        applyTheme();
        localStorage.setItem('theme', theme);
    }, [theme]);

    const loadData = async () => {
        try {
            const globalData = await db.getGlobalData();
            let loadedUsers: User[] = globalData?.users || [];

            if (loadedUsers.length === 0) {
                const adminUser: User = { 
                    fullName: 'المدير العام', 
                    phone: 'admin', 
                    password: 'admin', 
                    email: 'admin@example.com', 
                    stores: [], 
                    joinDate: new Date().toISOString(),
                    isAdmin: true 
                };
                loadedUsers.push(adminUser);
            }

            setUsers(loadedUsers);
            
            const savedUserPhone = localStorage.getItem('currentUserPhone');
            const savedStoreId = localStorage.getItem('lastActiveStoreId');
            const savedSessionType = localStorage.getItem('sessionType');
            
            if (savedUserPhone) {
                const user = loadedUsers.find((u: User) => u.phone === savedUserPhone);
                if (user) {
                    setCurrentUser(user);
                    if (savedSessionType === 'employee') {
                        setIsEmployeeSession(true);
                    }
                    const storeId = savedStoreId || user.stores?.[0]?.id;
                    if (storeId) {
                        setActiveStoreId(storeId);
                        const storeData = await db.getStoreData(storeId) as StoreData | null;
                        if (storeData) {
                            const sanitizedStoreData = sanitizeData(storeData);
                            setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedStoreData }));
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load initial data:", error);
        } finally {
            setAuthChecked(true);
            setIsInitialLoad(false);
        }
    };

    useEffect(() => {
        // PWA setup
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleDisplayModeChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleDisplayModeChange);
        setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);

        loadData();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            mediaQuery.removeEventListener('change', handleDisplayModeChange);
        };
    }, []);

    const handleLogout = () => {
        setCurrentUser(null);
        setActiveStoreId(null);
        setIsEmployeeSession(false);
        localStorage.removeItem('currentUserPhone');
        localStorage.removeItem('lastActiveStoreId');
        localStorage.removeItem('sessionType');
        setWelcomeScreenShown(false);
        navigate('/owner-login');
    };

    const handleOtpVerification = async (otp: string) => {
        if (!userForOtp) return;
        setOtpError('');

        try {
            const { data, error } = await supabase.functions.invoke('verify-otp', {
                body: { email: userForOtp.email, otp },
            });

            if (error) throw error;

            if (data.valid) {
                completeLogin(userForOtp, sessionInfoForOtp);
            } else {
                setOtpError(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
            }
        } catch (err: any) {
            console.error('Error verifying OTP:', err);
            setOtpError('حدث خطأ أثناء التحقق من الرمز. يرجى المحاولة مرة أخرى.');
        }
    };

    const handleOtpCancel = () => {
        setUserForOtp(null);
        setSessionInfoForOtp(null);
        setOtpError('');
    };
    
    const completeLogin = (user: User, sessionInfo: {isEmployee: boolean, storeId: string} | null) => {
        if (sessionInfo?.isEmployee) {
            setCurrentUser(user);
            setIsEmployeeSession(true);
            setActiveStoreId(sessionInfo.storeId);
            localStorage.setItem('currentUserPhone', user.phone);
            localStorage.setItem('lastActiveStoreId', sessionInfo.storeId);
            localStorage.setItem('sessionType', 'employee');
            navigate('/employee/dashboard');
        } else {
            setCurrentUser(user);
            setIsEmployeeSession(false);
            localStorage.setItem('currentUserPhone', user.phone);
            
            if (user.isAdmin) {
                localStorage.setItem('sessionType', 'admin');
                setActiveStoreId(null);
                localStorage.removeItem('lastActiveStoreId');
                navigate('/admin');
            } else {
                localStorage.setItem('sessionType', 'owner');
                const lastStoreId = localStorage.getItem('lastActiveStoreId');
                const firstStoreId = user.stores?.[0]?.id;
                
                if (lastStoreId && user.stores?.some(s => s.id === lastStoreId)) {
                    handleSetActiveStore(lastStoreId);
                    navigate('/');
                } else if (firstStoreId) {
                    handleSetActiveStore(firstStoreId);
                    navigate('/');
                } else {
                    setActiveStoreId(null); // No stores, so no active store
                    navigate('/create-store');
                }
            }
        }
    
        setUserForOtp(null);
        setSessionInfoForOtp(null);
        setOtpError('');
    };

    const handleSetActiveStore = async (storeId: string) => {
        setActiveStoreId(storeId);
        localStorage.setItem('lastActiveStoreId', storeId);
        setCart([]); // Reset cart on store switch
        if (!allStoresData[storeId]) {
            const storeData = await db.getStoreData(storeId) as StoreData | null;
            if (storeData) {
                const sanitizedStoreData = sanitizeData(storeData);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedStoreData }));
            }
        }
    };

    const handleEmployeeLogin = async ({ storeId, phone, password }: { storeId: string; phone: string; password: string }) => {
        // Find owner to validate storeId
        const owner = users.find(u => u.stores?.some(s => s.id === storeId));
        if (!owner) {
            throw new Error("كود المتجر غير صحيح.");
        }

        // Get store data
        let storeData = allStoresData[storeId];
        if (!storeData) {
            const data = await db.getStoreData(storeId) as StoreData | null;
            if (data) {
                const sanitizedData = sanitizeData(data);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedData }));
                storeData = sanitizedData;
            } else {
                 throw new Error("لا يمكن تحميل بيانات المتجر.");
            }
        }
        
        // Find employee in store
        const employeeRecord = storeData.settings.employees.find(e => e.id === phone);
        if (!employeeRecord) {
            throw new Error("لست موظفاً في هذا المتجر.");
        }

        if (employeeRecord.status !== 'active') {
            const statusMap: Record<string, string> = { 'invited': 'في انتظار القبول', 'pending': 'معلق' };
            const statusText = statusMap[employeeRecord.status || ''] || employeeRecord.status;
            throw new Error(`حالة حسابك هي "${statusText}". يرجى التواصل مع مدير المتجر.`);
        }

        // Find user account and check password
        const employeeUser = users.find(u => u.phone === phone);
        if (!employeeUser || employeeUser.password !== password) {
            throw new Error("رقم الهاتف أو كلمة المرور غير صحيحة.");
        }

        // Success!
        completeLogin(employeeUser, { isEmployee: true, storeId: storeId });
    };

    const handleEmployeeRegisterRequest = async (data: EmployeeRegisterRequestData) => {
        const { fullName, phone, password, storeId, email } = data;

        const owner = users.find(u => u.stores?.some(s => s.id === storeId));
        if (!owner) {
            throw new Error("كود المتجر غير صحيح.");
        }

        if (users.some(u => u.phone === phone)) {
            throw new Error("رقم الهاتف هذا مسجل بالفعل.");
        }
        if (users.some(u => u.email === email)) {
            throw new Error("هذا البريد الإلكتروني مسجل بالفعل.");
        }
        
        let storeData = allStoresData[storeId];
        if (!storeData) {
            const data = await db.getStoreData(storeId) as StoreData | null;
            if (data) {
                const sanitizedData = sanitizeData(data);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedData }));
                storeData = sanitizedData;
            } else {
                 throw new Error("لا يمكن تحميل بيانات المتجر.");
            }
        }
        if (storeData.settings.employees.some(e => e.id === phone)) {
            throw new Error("لديك بالفعل طلب انضمام معلق أو أنت موظف في هذا المتجر.");
        }

        const newUser: User = { fullName, phone, password, email, joinDate: new Date().toISOString() };
        setUsers(prev => [...prev, newUser]);

        const newEmployee: Employee = { id: phone, name: fullName, email, permissions: [], status: 'pending' };
        
        const updatedStoreData: StoreData = {
            ...storeData,
            settings: {
                ...storeData.settings,
                employees: [...storeData.settings.employees, newEmployee]
            }
        };

        setAllStoresData(p => ({
            ...p, 
            [storeId]: updatedStoreData
        }));

        const storeInfo = owner!.stores!.find(s => s.id === storeId);
        if (storeInfo) {
            await db.saveStoreData(storeInfo, updatedStoreData);
        }
    };

    const handleStoreCreated = (newStore: Store) => {
        if (!currentUser) return;

        const newStoreData: StoreData = {
            orders: [],
            settings: {
                ...INITIAL_SETTINGS,
                products: oneToolzProducts, // Pre-seed products for new stores
            },
            wallet: { balance: 0, transactions: [] },
            cart: [],
            customers: [],
        };
        
        const updatedUsers = users.map(user => {
            if (user.phone === currentUser.phone) {
                return { ...user, stores: [...(user.stores || []), newStore] };
            }
            return user;
        });

        setUsers(updatedUsers);
        setCurrentUser(prevUser => prevUser ? { ...prevUser, stores: [...(prevUser.stores || []), newStore] } : null);
        
        setAllStoresData(prevData => ({
            ...prevData,
            [newStore.id]: newStoreData
        }));
        
        handleSetActiveStore(newStore.id);
    };

    const handleManualMigration = async () => {
        const result = await db.migrateAllLegacyDataToRelational(users);
        if (!result.success && result.error) {
            alert(`فشل النقل!\nالخطأ: ${result.error}\nالملخص: ${result.summary}`);
        } else {
            alert(`اكتمل النقل!\nالملخص: ${result.summary}`);
        }
        return { success: result.success, error: result.error };
    };

    const handleImpersonate = (userToImpersonate: User) => {
        console.log(`Impersonating user: ${userToImpersonate.fullName}`);
        completeLogin(userToImpersonate, null); 
    };

    const refreshStoreData = (storeId: string) => {
        if (!storeId || storeId !== activeStoreId) {
            if (storeId !== activeStoreId) console.log(`[REALTIME] Ignoring refresh for non-active store: ${storeId}`);
            return;
        }

        if (refreshDebounceTimers.current[storeId]) {
            clearTimeout(refreshDebounceTimers.current[storeId]!);
        }

        refreshDebounceTimers.current[storeId] = setTimeout(async () => {
            console.log(`[REALTIME] Debounced refresh executing for store: ${storeId}`);
            const storeData = await db.getStoreData(storeId) as StoreData | null;
            if (storeData) {
                const sanitizedStoreData = sanitizeData(storeData);
                isRefreshing.current = true;
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedStoreData }));
                console.log(`[REALTIME] Store ${storeId} data updated via debounce.`);
            }
            refreshDebounceTimers.current[storeId] = null;
        }, 1500);
    };

    const refreshGlobalData = () => {
        const key = 'global';
        if (refreshDebounceTimers.current[key]) {
            clearTimeout(refreshDebounceTimers.current[key]!);
        }
        refreshDebounceTimers.current[key] = setTimeout(async () => {
            console.log('[REALTIME] Debounced global refresh executing.');
            const globalData = await db.getGlobalData();
            if (globalData?.users) {
                isRefreshing.current = true;
                setUsers(globalData.users);
                setCurrentUser(prevUser => {
                    if (!prevUser) return null;
                    const updatedCurrentUser = globalData.users.find(u => u.phone === prevUser.phone);
                    return updatedCurrentUser || prevUser;
                });
                console.log('[REALTIME] Global user data updated via debounce.');
            }
            refreshDebounceTimers.current[key] = null;
        }, 1500);
    };

    // --- Realtime Subscriptions ---
    useEffect(() => {
        console.log('[REALTIME] Setting up subscriptions...');
        
        const handleStoreChange = (payload: any) => {
            console.log('[REALTIME] Store data change detected:', payload);
            const record = payload.new || payload.old;
            const storeId = record.store_id || record.id;
            if (storeId) {
              refreshStoreData(storeId);
            }
        };
        
        const handleUserChange = (payload: any) => {
            console.log('[REALTIME] User data change detected:', payload);
            refreshGlobalData();
        };

        const subscriptions = [
          supabase.channel('public:orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleStoreChange).subscribe(),
          supabase.channel('public:stores_data').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores_data' }, handleStoreChange).subscribe(),
          supabase.channel('public:products').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, handleStoreChange).subscribe(),
          supabase.channel('public:transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, handleStoreChange).subscribe(),
          supabase.channel('public:employees').on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, handleStoreChange).subscribe(),
          supabase.channel('public:collections').on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, handleStoreChange).subscribe(),
          supabase.channel('public:custom_pages').on('postgres_changes', { event: '*', schema: 'public', table: 'custom_pages' }, handleStoreChange).subscribe(),
          supabase.channel('public:users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, handleUserChange).subscribe()
        ];

        return () => {
            console.log('[REALTIME] Removing subscriptions.');
            subscriptions.forEach(sub => supabase.removeChannel(sub));
        };
    }, [activeStoreId]); // Re-run if activeStoreId changes to update the refreshStoreData closure

    if (!authChecked) {
        return <GlobalLoader />;
    }

    if (userForOtp) {
        return <OtpVerificationPage 
            user={userForOtp} 
            onVerifyAttempt={handleOtpVerification}
            onCancel={handleOtpCancel}
            error={otpError}
        />;
    }
    
    // Props passed down to layouts and pages
    const pageProps = {
        users, setUsers, allStoresData, setAllStoresData, currentUser, activeStore,
        orders: activeStoreId ? allStoresData[activeStoreId]?.orders || [] : [],
        settings: activeStoreId ? allStoresData[activeStoreId]?.settings || INITIAL_SETTINGS : INITIAL_SETTINGS,
        wallet: activeStoreId ? allStoresData[activeStoreId]?.wallet || { balance: 0, transactions: [] } : { balance: 0, transactions: [] },
        cart,
        setOrders: (updater: any) => {
            if(activeStoreId) {
                // FIX: When updating store data, ensure a complete default object is provided if the store data doesn't exist yet, to satisfy the `StoreData` type.
                setAllStoresData(p => ({
                    ...p, 
                    [activeStoreId]: {
                        ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                        orders: typeof updater === 'function' ? updater(p[activeStoreId]?.orders || []) : updater
                    }
                }));
            }
        },
        setSettings: (updater: any) => {
            if(activeStoreId) {
                // FIX: When updating store data, ensure a complete default object is provided if the store data doesn't exist yet, to satisfy the `StoreData` type.
                setAllStoresData(p => ({
                    ...p, 
                    [activeStoreId]: {
                        ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                        settings: typeof updater === 'function' ? updater(p[activeStoreId]?.settings || INITIAL_SETTINGS) : updater
                    }
                }));
            }
        },
        setWallet: (updater: any) => {
             if(activeStoreId) {
                // FIX: When updating store data, ensure a complete default object is provided if the store data doesn't exist yet, to satisfy the `StoreData` type.
                setAllStoresData(p => ({
                    ...p, 
                    [activeStoreId]: {
                        ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                        wallet: typeof updater === 'function' ? updater(p[activeStoreId]?.wallet || { balance: 0, transactions: [] }) : updater
                    }
                }));
            }
        },
    };
    
    // This component acts as a guard for owner routes.
    const OwnerLayoutWrapper = () => {
        const location = useLocation();
    
        useEffect(() => {
            if (!welcomeScreenShown) {
                const timer = setTimeout(() => {
                    setWelcomeScreenShown(true);
                }, 1500);
                return () => clearTimeout(timer);
            }
        }, [welcomeScreenShown]);
    
        if (isEmployeeSession) {
            return <Navigate to="/employee/dashboard" replace />;
        }
        if (!currentUser) {
            return <Navigate to="/owner-login" replace />;
        }
    
        const hasNoStores = !currentUser.stores || currentUser.stores.length === 0;
    
        if (hasNoStores && !currentUser.isAdmin) {
            if (location.pathname !== '/create-store') {
                return <Navigate to="/create-store" replace />;
            }
            return (
                <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-slate-950 dark:to-[#111827] text-slate-800 dark:text-slate-200 min-h-screen" dir="rtl">
                    <Header currentUser={currentUser} onLogout={handleLogout} onToggleSidebar={() => {}} theme={theme} setTheme={setTheme} />
                    <main className="flex-1 p-4 md:p-6">
                        <Outlet />
                    </main>
                </div>
            );
        }
    
        if (!welcomeScreenShown) {
            return <WelcomeLoader userName={currentUser?.fullName.split(' ')[0] || ''} />;
        }
    
        return <MainLayout currentUser={currentUser} handleLogout={handleLogout} isSidebarOpen={isSidebarOpen} setSidebarOpen={setIsSidebarOpen} activeStore={activeStore} theme={theme} setTheme={setTheme} />;
    };
    
    // This component handles redirection for any undefined routes.
    const CatchAllRedirect = () => {
        if (!currentUser) {
            return <Navigate to="/owner-login" replace />;
        }
        if (isEmployeeSession) {
            return <Navigate to="/employee/dashboard" replace />;
        }
        if (currentUser.isAdmin) {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/" replace />;
    };

    return (
        <>
            <Routes>
                <Route path="/owner-login" element={<SignUpPage onPasswordSuccess={(user) => completeLogin(user, null)} users={users} setUsers={setUsers} />} />
                <Route path="/employee-login" element={<EmployeeLoginPage allStoresData={allStoresData} users={users} onLoginAttempt={handleEmployeeLogin} onRegisterRequest={handleEmployeeRegisterRequest} />} />
                <Route path="/track-order" element={<OrderTrackingPage orders={pageProps.orders} />} />
                
                <Route path="/admin" element={<AdminLayout currentUser={currentUser} handleLogout={handleLogout} theme={theme} setTheme={setTheme} />}>
                    <Route index element={<AdminPage {...pageProps} onImpersonate={handleImpersonate} currentUser={currentUser as User} />} />
                    <Route path="manage-stores" element={<ManageSitesPage ownedStores={currentUser?.stores || []} collaboratingStores={[]} setActiveStoreId={handleSetActiveStore} {...pageProps} />} />
                    <Route path="account-settings" element={<AccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                </Route>

                <Route path="/employee" element={
                    <EmployeeLayoutWrapper 
                        currentUser={currentUser} onLogout={handleLogout}
                        storeOwner={users.find(u => u.stores?.some(s => s.id === activeStoreId))}
                        activeStoreId={activeStoreId}
                        theme={theme} setTheme={setTheme}
                        allStoresData={allStoresData} users={users}
                        handleSetActiveStore={handleSetActiveStore}
                        installPrompt={installPrompt} onInstall={() => installPrompt?.prompt()}
                        isStandalone={isStandalone} isIos={isIos}
                    >
                        <Outlet/>
                    </EmployeeLayoutWrapper>
                }>
                    <Route index element={<EmployeeDashboardPage currentUser={currentUser} orders={pageProps.orders} />} />
                    <Route path="dashboard" element={<EmployeeDashboardPage currentUser={currentUser} orders={pageProps.orders} />} />
                    <Route path="confirmation-queue" element={<ConfirmationQueuePage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} activeStore={pageProps.activeStore} />} />
                    <Route path="my-activity" element={<EmployeeActivityPage currentUser={currentUser} orders={pageProps.orders} />} />
                    <Route path="account-settings" element={<EmployeeAccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                </Route>

                <Route path="/" element={<OwnerLayoutWrapper />}>
                    <Route index element={<Dashboard {...pageProps} />} />
                    <Route path="confirmation-queue" element={<ConfirmationQueuePage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} activeStore={pageProps.activeStore} />} />
                    <Route path="orders" element={<OrdersList {...pageProps} addLoyaltyPointsForOrder={() => {}} />} />
                    <Route path="products" element={<ProductsPage {...pageProps} />} />
                    <Route path="customers" element={<CustomersPage orders={pageProps.orders} loyaltyData={{}} updateCustomerLoyaltyPoints={() => {}} />} />
                    <Route path="wallet" element={<WalletPage {...pageProps} />} />
                    <Route path="settings" element={<SettingsPage {...pageProps} onManualSave={currentUser?.isAdmin ? handleManualMigration : undefined} />} />
                    <Route path="customize-store" element={<StoreCustomizationPage {...pageProps} />} />
                    <Route path="shipping" element={<ShippingPage {...pageProps} />} />
                    <Route path="create-store" element={<CreateStorePage currentUser={currentUser} onStoreCreated={handleStoreCreated} />} />
                    <Route path="manage-stores" element={<ManageSitesPage ownedStores={currentUser?.stores || []} collaboratingStores={[]} setActiveStoreId={handleSetActiveStore} {...pageProps} />} />
                    <Route path="abandoned-carts" element={<AbandonedCartsPage {...pageProps} />} />
                    <Route path="discounts" element={<DiscountsPage {...pageProps} />} />
                    <Route path="reviews" element={<ReviewsPage {...pageProps} />} />
                    <Route path="collections" element={<CollectionsPage {...pageProps} />} />
                    <Route path="product-options" element={<ProductOptionsPage {...pageProps} />} />
                    <Route path="expenses" element={<ExpensesPage {...pageProps} />} />
                    <Route path="marketing" element={<MarketingPage {...pageProps} />} />
                    <Route path="ai-assistant" element={<ChatBot {...pageProps} />} />
                    <Route path="reports" element={<AnalyticsPage {...pageProps} />} />
                    <Route path="standard-reports" element={<ReportsPage {...pageProps} />} />
                    <Route path="collections-report" element={<CollectionsReportPage {...pageProps} />} />
                    <Route path="activity-logs" element={<ActivityLogsPage logs={pageProps.settings.activityLogs || []} />} />
                    <Route path="suppliers" element={<SuppliersPage {...pageProps} />} />
                    <Route path="pages" element={<PagesManager {...pageProps} />} />
                    <Route path="settings/payment" element={<PaymentSettingsPage {...pageProps} />} />
                    <Route path="settings/employees" element={<EmployeesPage {...pageProps} activeStoreId={activeStoreId} />} />
                    <Route path="team-chat" element={<TeamChatPage {...pageProps} activeStoreId={activeStoreId} />} />
                    <Route path="whatsapp" element={<WhatsAppPage {...pageProps} />} />
                    <Route path="account-settings" element={<AccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                    
                    {/* Coming Soon Routes */}
                    <Route path="product-attributes" element={<ComingSoonPage />} />
                    <Route path="withdrawals" element={<ComingSoonPage />} />
                    <Route path="design-templates" element={<ComingSoonPage />} />
                    <Route path="domain" element={<ComingSoonPage />} />
                    <Route path="legal-pages" element={<ComingSoonPage />} />
                    <Route path="apps" element={<ComingSoonPage />} />
                    <Route path="settings/tax" element={<ComingSoonPage />} />
                    <Route path="settings/developer" element={<ComingSoonPage />} />
                </Route>

                <Route path="store" element={<StorefrontPage {...pageProps} onAddToCart={() => {}} onUpdateCartQuantity={() => {}} onRemoveFromCart={() => {}} />} />
                <Route path="checkout" element={<CheckoutPage {...pageProps} onPlaceOrder={() => '123'} />} />
                <Route path="order-success/:orderId" element={<OrderSuccessPage {...pageProps} />} />
                <Route path="*" element={<CatchAllRedirect />} />
            </Routes>
            {showCongratsModal && <CongratsModal onClose={() => setShowCongratsModal(false)} />}
            <GlobalSaveIndicator status={saveStatus} message={saveMessage} />
        </>
    );
};

// Wrapper needed for react-router v6 hooks
export const AppWrapper = () => (
    <HashRouter>
        <AppComponent />
    </HashRouter>
);

// We keep a named export for index.tsx, but the app itself is now a React app.
// The default export is what matters for the React ecosystem.
export default AppWrapper;
