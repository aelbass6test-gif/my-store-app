import { useState, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';

// استيراد الأنواع والخدمات
import { User, StoreData, OrderItem } from './types';
import * as db from './services/databaseService';
import { supabase } from './services/supabaseClient';
import { INITIAL_SETTINGS } from './constants';
import GlobalSaveIndicator, { SaveStatus } from './components/GlobalSaveIndicator';

// استيراد المكونات الأساسية
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdersList from './components/OrdersList';
import SignUpPage from './components/SignUpPage';
import GlobalLoader from './components/GlobalLoader';

// --- مكون الـ Layout الرئيسي ---
// هذا المكون هو المسؤول عن عرض الـ Sidebar والـ Header في كل الصفحات
const MainLayout = ({ currentUser, onLogout, isSidebarOpen, setSidebarOpen, activeStore }: any) => {
    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950" dir="rtl">
            <Header currentUser={currentUser} onLogout={onLogout} onToggleSidebar={() => setSidebarOpen(true)} />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar activeStore={activeStore} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex-1 overflow-y-auto p-4">
                    {/* الـ Outlet هو المحرك الذي يعرض الصفحة المختارة بناءً على الرابط */}
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export const AppComponent = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [allStoresData, setAllStoresData] = useState<Record<string, StoreData>>({});
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    const navigate = useNavigate();
    const location = useLocation();

    // حل مشكلة التنقل: إغلاق القائمة الجانبية فور تغيير المسار
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // حساب المتجر النشط حالياً
    const activeStore = useMemo(() => {
        if (!activeStoreId) return undefined;
        return users.find(u => u.stores?.some(s => s.id === activeStoreId))?.stores?.find(s => s.id === activeStoreId);
    }, [activeStoreId, users]);

    // تحميل البيانات الأولي عند فتح التطبيق
    useEffect(() => {
        const loadInitialData = async () => {
            const global = await db.getGlobalData();
            if (global?.users) setUsers(global.users);
            
            const savedPhone = localStorage.getItem('currentUserPhone');
            if (savedPhone) {
                const user = global?.users.find((u: any) => u.phone === savedPhone);
                if (user) {
                    setCurrentUser(user);
                    const storeId = localStorage.getItem('lastActiveStoreId') || user.stores?.[0]?.id;
                    if (storeId) {
                        setActiveStoreId(storeId);
                        const data = await db.getStoreData(storeId);
                        if (data) setAllStoresData({ [storeId]: data as StoreData });
                    }
                }
            }
            setAuthChecked(true);
        };
        loadInitialData();
    }, []);

    const pageProps = {
        users, setUsers, allStoresData, setAllStoresData, currentUser, activeStore,
        orders: activeStoreId ? allStoresData[activeStoreId]?.orders || [] : [],
        settings: activeStoreId ? allStoresData[activeStoreId]?.settings || INITIAL_SETTINGS : INITIAL_SETTINGS,
    };

    if (!authChecked) return <GlobalLoader />;

    return (
        <>
            <Routes>
                {/* 1. المسارات المحمية (تحتاج تسجيل دخول) */}
                <Route path="/" element={currentUser ? (
                    <MainLayout 
                        currentUser={currentUser} 
                        onLogout={() => { localStorage.clear(); setCurrentUser(null); navigate('/login'); }}
                        isSidebarOpen={isSidebarOpen} 
                        setSidebarOpen={setSidebarOpen}
                        activeStore={activeStore}
                    />
                ) : <Navigate to="/login" replace />}>
                    
                    {/* هذه الصفحات تظهر داخل الـ MainLayout مكان الـ Outlet */}
                    <Route index element={<Dashboard {...pageProps} />} />
                    <Route path="orders" element={<OrdersList {...pageProps} />} />
                    <Route path="products" element={<div>صفحة المنتجات</div>} />
                    <Route path="customers" element={<div>صفحة العملاء</div>} />
                    <Route path="settings" element={<div>صفحة الإعدادات</div>} />
                </Route>

                {/* 2. مسارات خارج الـ Layout (بدون هيدر أو سايد بار) */}
                <Route path="/login" element={<SignUpPage onLoginSuccess={() => navigate('/')} />} />
                
                {/* 3. توجيه أي مسار خاطئ للرئيسية */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            
            <GlobalSaveIndicator status={saveStatus} />
        </>
    );
};

// المكون النهائي الذي يتم استدعاؤه في index.tsx
const AppWrapper = () => (
    <HashRouter>
        <AppComponent />
    </HashRouter>
);

export default AppWrapper;
