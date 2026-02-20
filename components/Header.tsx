// FIX: Import 'useMemo' from 'react' to resolve 'Cannot find name' error.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { Menu, ChevronDown, User as UserIcon, Settings, LogOut, ExternalLink, Replace, Sun, Moon, Monitor } from 'lucide-react';

const PATH_TITLES: { [key: string]: string } = {
    '/': 'الرئيسية',
    '/confirmation-queue': 'تأكيد الطلبات',
    '/orders': 'الطلبات',
    '/abandoned-carts': 'السلات المتروكة',
    '/products': 'المنتجات',
    '/suppliers': 'الموردين والمخزون',
    '/customers': 'العملاء',
    '/marketing': 'مساعد التسويق الذكي',
    '/discounts': 'كوبونات الخصم',
    '/shipping': 'الشحن',
    '/wallet': 'المحفظة',
    '/collections-report': 'التحصيلات',
    '/customize-store': 'المظهر',
    '/pages': 'الصفحات',
    '/reports': 'التحليلات الذكية',
    '/standard-reports': 'مركز التقارير',
    '/activity-logs': 'سجل النشاط',
    '/settings': 'الإعدادات العامة',
    '/settings/employees': 'الموظفون',
    '/admin/account-settings': 'إعدادات الحساب',
    '/account-settings': 'إعدادات الحساب',
};

interface HeaderProps {
    currentUser: User | null;
    onLogout: () => void;
    onToggleSidebar: () => void;
    theme: string;
    setTheme: (theme: string) => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, onToggleSidebar, theme, setTheme }) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const handleManageStoresClick = () => {
        if (currentUser?.isAdmin) {
            navigate('/admin/manage-stores');
        } else {
            navigate('/manage-stores');
        }
    };

    const pageTitle = useMemo(() => {
        const path = location.pathname;
        const title = Object.entries(PATH_TITLES).find(([key, _]) => path.startsWith(key) && key !== '/');
        return PATH_TITLES[path] || (title ? title[1] : 'الرئيسية');
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const handleLogout = () => {
        setIsUserMenuOpen(false);
        onLogout();
    };

    const getUserInitials = (name: string) => {
        const names = name.split(' ');
        return names.length > 1 && names[names.length - 1]
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    return (
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40 flex-shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onToggleSidebar} className="md:hidden text-slate-500">
                    <Menu size={24} />
                </button>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={handleManageStoresClick}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                    <Replace size={16} />
                    <span>تغيير المتجر</span>
                </button>
                
                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-900">
                            {currentUser ? getUserInitials(currentUser.fullName) : '..'}
                        </div>
                        <div className="hidden md:block text-right">
                            <div className="font-bold text-sm text-slate-800 dark:text-white">{currentUser?.fullName}</div>
                            <div className="text-xs text-slate-500">{currentUser?.email}</div>
                        </div>
                        <ChevronDown size={16} className={`hidden md:block text-slate-400 transition-transform ${isUserMenuOpen && 'rotate-180'}`} />
                    </button>
                    {isUserMenuOpen && (
                        <div className="absolute left-0 top-14 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 p-2 z-50">
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 mb-2">
                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{currentUser?.fullName}</p>
                                <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                            </div>
                            <Link to={currentUser?.isAdmin ? "/admin/account-settings" : "/account-settings"} onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">
                                <UserIcon size={16} /> <span>ملفي الشخصي</span>
                            </Link>
                            <a href="https://docs.wuilt.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">
                                <div className="flex items-center gap-3">
                                    <Settings size={16} /> <span>مركز المساعدة</span>
                                </div>
                                <ExternalLink size={14} />
                            </a>
                            <div className="w-full h-px bg-slate-100 dark:border-slate-700 my-1"></div>
                            <div className="px-3 py-2">
                                <p className="text-xs font-bold text-slate-400 mb-2">المظهر</p>
                                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-md p-1 gap-1">
                                    <button onClick={() => setTheme('light')} className={`w-full flex justify-center items-center gap-1.5 py-1 text-xs rounded-sm font-bold transition-colors ${theme === 'light' ? 'bg-white dark:bg-slate-900 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Sun size={14}/><span>فاتح</span></button>
                                    <button onClick={() => setTheme('dark')} className={`w-full flex justify-center items-center gap-1.5 py-1 text-xs rounded-sm font-bold transition-colors ${theme === 'dark' ? 'bg-white dark:bg-slate-900 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Moon size={14}/><span>داكن</span></button>
                                    <button onClick={() => setTheme('system')} className={`w-full flex justify-center items-center gap-1.5 py-1 text-xs rounded-sm font-bold transition-colors ${theme === 'system' ? 'bg-white dark:bg-slate-900 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Monitor size={14}/><span>النظام</span></button>
                                </div>
                            </div>
                            <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                            <button onClick={handleLogout} className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-red-500 font-bold text-sm">
                                <LogOut size={16} /> <span>تسجيل الخروج</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
