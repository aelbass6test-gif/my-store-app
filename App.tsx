import { useState, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Outlet, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';

import { User, Store, StoreData, Order, Settings, Wallet, OrderItem, Employee, Product, PlaceOrderData } from './types';
import * as db from './services/databaseService';
import { supabase } from './services/supabaseClient';
import { INITIAL_SETTINGS } from './constants';
import GlobalSaveIndicator, { SaveStatus } from './components/GlobalSaveIndicator';
import { oneToolzProducts } from './data/one-toolz-products';

import { triggerWebhooks } from './utils/webhook';

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
import DeveloperSettingsPage from './components/DeveloperSettingsPage';
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
import AppsPage from './components/AppsPage';

interface EmployeeRegisterRequestData {
  fullName: string;
  phone: string;
  password: string;
  storeId: string;
  email: string;
}

const MainLayout = ({ currentUser, handleLogout, isSidebarOpen, setSidebarOpen, activeStore, theme, setTheme }: any) => {
    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50" dir="rtl">
    <Header currentUser={currentUser} onLogout={handleLogout} onToggleSidebar={() => setSidebarOpen(true)} theme={theme} setTheme={setTheme} activeStore={activeStore} />
    <div className="flex flex-1 overflow-hidden">
        <Sidebar activeStore={activeStore} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
            <Outlet />
        </main>
    </div>
</div>
    );
};

const AdminLayout = ({ currentUser, handleLogout, theme, setTheme }: any) => (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50" dir="rtl">
    <Header currentUser={currentUser} onLogout={handleLogout} theme={theme} setTheme={setTheme} onToggleSidebar={() => {}} />
    <main className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
        <Outlet />
    </main>
</div>
);

const EmployeeLayoutWrapper = ({ children, ...props }: any) => {
    return <EmployeeLayout {...props}>{children}</EmployeeLayout>;
};

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
        } else {
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

// -------------------------------------------------------------------------------------------------
// تم سحب المكونات الداخلية للخارج لمنع إعادة البناء وتدمير واجهة المستخدم (The Flicker Fix)
// -------------------------------------------------------------------------------------------------
const OwnerLayoutWrapper = ({
    currentUser,
    isEmployeeSession,
    welcomeScreenShown,
    setWelcomeScreenShown,
    handleLogout,
    isSidebarOpen,
    setIsSidebarOpen,
    activeStore,
    theme,
    setTheme
}: any) => {
    const location = useLocation();

    useEffect(() => {
        if (!welcomeScreenShown) {
            const timer = setTimeout(() => {
                setWelcomeScreenShown(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [welcomeScreenShown, setWelcomeScreenShown]);

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

const CatchAllRedirect = ({ currentUser, isEmployeeSession }: any) => {
    if (!currentUser) return <Navigate to="/owner-login" replace />;
    if (isEmployeeSession) return <Navigate to="/employee/dashboard" replace />;
    if (currentUser.isAdmin) return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
};
// -------------------------------------------------------------------------------------------------


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
    const location = useLocation();

    // إغلاق القائمة تلقائياً عند تغيير المسار في الموبايل
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // تتبع حالة الحفظ لمنع تداخل التحديثات اللحظية
    const isSavingRef = useRef(false);
    useEffect(() => {
        isSavingRef.current = (saveStatus === 'saving' || saveStatus === 'pending');
    }, [saveStatus]);

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
            isRefreshing.current = false; 
            return;
        }

        if (saveStatus === 'success' || saveStatus === 'idle' || saveStatus === 'error') {
            setSaveStatus('pending');
            setSaveMessage('تغييرات غير محفوظة...');
        }

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(async () => {
            setSaveStatus('saving');
            setSaveMessage('جاري الحفظ...');

            try {
                await db.saveGlobalData({ users, loyaltyData: {} });

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
        }, 800); 

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
                    setActiveStoreId(null); 
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
        setCart([]); 
        if (!allStoresData[storeId]) {
            const storeData = await db.getStoreData(storeId) as StoreData | null;
            if (storeData) {
                const sanitizedStoreData = sanitizeData(storeData);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedStoreData }));
            }
        }
    };

    const handleEmployeeLogin = async ({ storeId, phone, password }: { storeId: string; phone: string; password: string }) => {
        const owner = users.find(u => u.stores?.some(s => s.id === storeId));
        if (!owner) {
            throw new Error("كود المتجر غير صحيح.");
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
        
        const employeeRecord = storeData.settings.employees.find(e => e.id === phone);
        if (!employeeRecord) {
            throw new Error("لست موظفاً في هذا المتجر.");
        }

        if (employeeRecord.status !== 'active') {
            const statusMap: Record<string, string> = { 'invited': 'في انتظار القبول', 'pending': 'معلق' };
            const statusText = statusMap[employeeRecord.status || ''] || employeeRecord.status;
            throw new Error(`حالة حسابك هي "${statusText}". يرجى التواصل مع مدير المتجر.`);
        }

        const employeeUser = users.find(u => u.phone === phone);
        if (!employeeUser || employeeUser.password !== password) {
            throw new Error("رقم الهاتف أو كلمة المرور غير صحيحة.");
        }

        completeLogin(employeeUser, { isEmployee: true, storeId: storeId });
    };

    const handleEmployeeRegisterRequest = async (data: EmployeeRegisterRequestData) => {
        const { fullName, phone, password, storeId, email } = data;

        const owner = users.find(u => u.stores?.some(s => s.id === storeId));
        if (!owner) throw new Error("كود المتجر غير صحيح.");
        if (users.some(u => u.phone === phone)) throw new Error("رقم الهاتف هذا مسجل بالفعل.");
        if (users.some(u => u.email === email)) throw new Error("هذا البريد الإلكتروني مسجل بالفعل.");
        
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
                products: oneToolzProducts, 
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

    const refreshStoreData = (storeId: string): Promise<void> => {
        if (isSavingRef.current) {
            console.log(`[REALTIME] Ignoring refresh to prevent flicker during active save.`);
            return Promise.resolve();
        }

        if (!storeId || storeId !== activeStoreId) {
            if (storeId !== activeStoreId) console.log(`[REALTIME] Ignoring refresh for non-active store: ${storeId}`);
            return Promise.resolve();
        }

        if (refreshDebounceTimers.current[storeId]) {
            clearTimeout(refreshDebounceTimers.current[storeId]!);
        }

        return new Promise((resolve) => {
            refreshDebounceTimers.current[storeId] = setTimeout(async () => {
                console.log(`[REALTIME] Debounced refresh executing for store: ${storeId}`);
                const storeData = await db.getStoreData(storeId) as StoreData | null;
                if (storeData) {
                    const sanitizedStoreData = sanitizeData(storeData);
                    
                    setAllStoresData(prev => {
                        const isIdentical = JSON.stringify(prev[storeId]) === JSON.stringify(sanitizedStoreData);
                        if (isIdentical) {
                            resolve();
                            return prev;
                        }
                        
                        isRefreshing.current = true;
                        return { ...prev, [storeId]: sanitizedStoreData };
                    });
                    console.log(`[REALTIME] Store ${storeId} data updated via debounce.`);
                }
                refreshDebounceTimers.current[storeId] = null;
                resolve();
            }, 500);
        });
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

        // Fallback polling mechanism in case Realtime is not enabled in Supabase
        const pollingInterval = setInterval(() => {
            if (activeStoreId && !isSavingRef.current) {
                refreshStoreData(activeStoreId);
            }
        }, 5000); // Poll every 5 seconds

        // Background Auto-Sync for Platforms (Wuilt, etc.)
        const autoSyncInterval = setInterval(async () => {
            if (activeStoreId && !isSavingRef.current && activeStore) {
                const connectedPlatforms = allStoresData[activeStoreId]?.settings?.connectedPlatforms || [];
                const platformConfigs = (allStoresData[activeStoreId]?.settings as any)?.platformConfigs || {};

                for (const platformId of connectedPlatforms) {
                    const config = platformConfigs[platformId];
                    if (config?.isActive) {
                        console.log(`[AUTO-SYNC] Triggering background sync for ${platformId}...`);
                        try {
                            // Set refreshing flag early to block auto-saves during the sync window
                            isRefreshing.current = true;
                            
                            const response = await fetch(`/api/sync/platform/${platformId}/${activeStoreId}?type=orders`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            if (response.ok) {
                                console.log(`[AUTO-SYNC] Successfully synced orders for ${platformId}`);
                                // Immediately refresh to pick up the new data and avoid stale state save-backs
                                await refreshStoreData(activeStoreId);
                            } else {
                                isRefreshing.current = false;
                            }
                        } catch (err) {
                            console.error(`[AUTO-SYNC] Failed to sync ${platformId}:`, err);
                            isRefreshing.current = false;
                        }
                    }
                }
            }
        }, 120000); // Every 2 minutes

        return () => {
            console.log('[REALTIME] Removing subscriptions and polling.');
            subscriptions.forEach(sub => supabase.removeChannel(sub));
            clearInterval(pollingInterval);
            clearInterval(autoSyncInterval);
        };
    }, [activeStoreId]); 

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
    
    const forceSync = async () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
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
    };

    const pageProps = {
        users, setUsers, allStoresData, setAllStoresData, currentUser, activeStore, activeStoreId,
        orders: activeStoreId ? allStoresData[activeStoreId]?.orders || [] : [],
        products: activeStoreId ? allStoresData[activeStoreId]?.settings?.products || [] : [],
        settings: activeStoreId ? allStoresData[activeStoreId]?.settings || INITIAL_SETTINGS : INITIAL_SETTINGS,
        wallet: activeStoreId ? allStoresData[activeStoreId]?.wallet || { balance: 0, transactions: [] } : { balance: 0, transactions: [] },
        cart,
        forceSync,
        onRefresh: async () => { if (activeStoreId) await refreshStoreData(activeStoreId); },
        customers: activeStoreId ? allStoresData[activeStoreId]?.customers || [] : [],
        setCustomers: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentCustomers = p[activeStoreId]?.customers || [];
                    const newCustomers = typeof updater === 'function' ? updater(currentCustomers) : updater;
                    
                    if (currentCustomers === newCustomers) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            customers: newCustomers
                        }
                    };
                });
            }
        },
        setOrders: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentOrders = p[activeStoreId]?.orders || [];
                    const newOrders = typeof updater === 'function' ? updater(currentOrders) : updater;
                    
                    if (currentOrders === newOrders) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            orders: newOrders
                        }
                    };
                });
            }
        },
        setSettings: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentSettings = p[activeStoreId]?.settings || INITIAL_SETTINGS;
                    const newSettings = typeof updater === 'function' ? updater(currentSettings) : updater;
                    
                    if (currentSettings === newSettings) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            settings: newSettings
                        }
                    };
                });
            }
        },
        setWallet: (updater: any) => {
             if(activeStoreId) {
                setAllStoresData(p => {
                    const currentWallet = p[activeStoreId]?.wallet || { balance: 0, transactions: [] };
                    const newWallet = typeof updater === 'function' ? updater(currentWallet) : updater;
                    
                    if (currentWallet === newWallet) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            wallet: newWallet
                        }
                    };
                });
            }
        },
        setCart: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentCart = p[activeStoreId]?.cart || [];
                    const newCart = typeof updater === 'function' ? updater(currentCart) : updater;
                    
                    if (currentCart === newCart) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            cart: newCart
                        }
                    };
                });
            }
        },
    };

    const handlePlaceOrder = (orderData: any) => {
        if (!activeStoreId) return '123';
        const newOrder: Order = {
            id: `order-${Date.now()}`,
            orderNumber: `ORD-${Math.floor(Math.random() * 10000)}`,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerAddress: orderData.customerAddress,
            shippingCompany: orderData.shippingCompany,
            shippingArea: orderData.shippingArea,
            shippingFee: orderData.shippingFee,
            notes: orderData.notes,
            status: 'في_انتظار_المكالمة',
            date: new Date().toISOString(),
            items: pageProps.cart.map((item: any) => ({
                productId: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                cost: item.cost || 0,
                weight: item.weight || 0,
            })),
            productPrice: pageProps.cart.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0),
            productCost: pageProps.cart.reduce((sum: number, item: any) => sum + ((item.cost || 0) * (item.quantity || 1)), 0),
            weight: pageProps.cart.reduce((sum: number, item: any) => sum + ((item.weight || 0) * (item.quantity || 1)), 0),
            discount: orderData.discount || 0,
            orderType: 'standard',
            paymentMethod: 'cash_on_delivery',
            productName: pageProps.cart.map((i: any) => i.name).join(', '),
            includeInspectionFee: false,
            isInsured: false,
            paymentStatus: 'بانتظار الدفع',
            preparationStatus: 'بانتظار التجهيز',
        };
        
        pageProps.setOrders((prev: Order[]) => [newOrder, ...prev]);
        pageProps.setCart([]); // Clear cart
        triggerWebhooks(newOrder, pageProps.settings);
        return newOrder.id;
    };

    const handleAddToCart = (product: any) => {
        pageProps.setCart((prev: any[]) => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const handleUpdateCartQuantity = (id: string, quantity: number) => {
        pageProps.setCart((prev: any[]) => prev.map(item => item.id === id ? { ...item, quantity } : item));
    };

    const handleRemoveFromCart = (id: string) => {
        pageProps.setCart((prev: any[]) => prev.filter(item => item.id !== id));
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
                    <Route index element={<EmployeeDashboardPage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} />} />
                    <Route path="dashboard" element={<EmployeeDashboardPage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} />} />
                    <Route path="confirmation-queue" element={<ConfirmationQueuePage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} activeStore={pageProps.activeStore} onRefresh={() => pageProps.activeStore?.id && refreshStoreData(pageProps.activeStore.id)} forceSync={pageProps.forceSync} />} />
                    <Route path="my-activity" element={<EmployeeActivityPage currentUser={currentUser} orders={pageProps.orders} />} />
                    <Route path="account-settings" element={<EmployeeAccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                </Route>

                <Route path="/" element={
                    <OwnerLayoutWrapper
                        currentUser={currentUser}
                        isEmployeeSession={isEmployeeSession}
                        welcomeScreenShown={welcomeScreenShown}
                        setWelcomeScreenShown={setWelcomeScreenShown}
                        handleLogout={handleLogout}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        activeStore={activeStore}
                        theme={theme}
                        setTheme={setTheme}
                    />
                }>
                    <Route index element={<Dashboard {...pageProps} />} />
                    <Route path="confirmation-queue" element={<ConfirmationQueuePage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} activeStore={pageProps.activeStore} onRefresh={() => pageProps.activeStore?.id && refreshStoreData(pageProps.activeStore.id)} forceSync={pageProps.forceSync} />} />
                    <Route path="orders" element={<OrdersList {...pageProps} currentUser={currentUser} addLoyaltyPointsForOrder={() => {}} />} />
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
                    <Route path="apps" element={<AppsPage storeId={activeStoreId} storeData={allStoresData[activeStoreId] || null} onUpdateSettings={pageProps.setSettings} onRefresh={pageProps.onRefresh} hostUrl={pageProps.settings.customAppDomain || window.location.origin} />} />
                    <Route path="settings/tax" element={<ComingSoonPage />} />
                    <Route path="settings/developer" element={<DeveloperSettingsPage settings={pageProps.settings} setSettings={pageProps.setSettings} activeStoreId={activeStoreId} hostUrl={pageProps.settings.customAppDomain || window.location.origin} />} />
                </Route>

                <Route path="store" element={<StorefrontPage {...pageProps} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onRemoveFromCart={handleRemoveFromCart} />} />
                <Route path="checkout" element={<CheckoutPage {...pageProps} onPlaceOrder={handlePlaceOrder} />} />
                <Route path="order-success/:orderId" element={<OrderSuccessPage {...pageProps} />} />
                <Route path="*" element={<CatchAllRedirect currentUser={currentUser} isEmployeeSession={isEmployeeSession} />} />
            </Routes>
            {showCongratsModal && <CongratsModal onClose={() => setShowCongratsModal(false)} />}
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

