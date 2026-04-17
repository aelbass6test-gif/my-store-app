import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Store, Mail, User as UserIcon, ShieldAlert, Phone, KeyRound, LogIn, UserPlus, Loader2, X, BarChart, Settings, Users, ArrowLeft, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { motion } from 'framer-motion';

// --- Reusable UI Components ---
const FeatureCard: React.FC<{ icon: React.ReactElement<{ size?: number, className?: string }>; title: string; description: string; }> = ({ icon, title, description }) => (
  <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-center transition-all hover:-translate-y-2 hover:border-indigo-500/50">
    <div className="inline-block p-4 bg-slate-700/50 rounded-full mb-4 border border-slate-600">
        {React.cloneElement(icon, { size: 32, className:"text-indigo-400" })}
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-slate-400 text-sm">{description}</p>
  </div>
);

const StepCard: React.FC<{ number: string; title: string; description: string; }> = ({ number, title, description }) => (
  <div className="text-center">
    <div className="relative inline-block">
      <div className="w-16 h-16 bg-slate-800/80 border border-slate-700 rounded-full flex items-center justify-center font-black text-3xl text-indigo-400 mb-4">{number}</div>
    </div>
    <h3 className="text-2xl font-bold mb-2">{title}</h3>
    <p className="text-slate-400 max-w-xs mx-auto">{description}</p>
  </div>
);

const AuthModal: React.FC<{
  onClose: () => void;
  children: React.ReactNode;
}> = ({ onClose, children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      className="relative w-full max-w-md"
      onClick={e => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute -top-3 -right-3 z-10 p-2 bg-slate-700 hover:bg-red-500 rounded-full text-white transition-colors">
        <X size={20} />
      </button>
      {children}
    </motion.div>
  </motion.div>
);


// --- Main Page Component ---
interface SignUpPageProps {
  onPasswordSuccess: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onPasswordSuccess, users, setUsers }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [showAdminTab, setShowAdminTab] = useState(false);
  
  // User form state
  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userError, setUserError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Admin form state
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const openAuthModal = (isLogin: boolean) => {
    setIsLoginView(isLogin);
    setShowAuthModal(true);
  };
  
  useEffect(() => {
    if (userPhone === 'ADMINLOGIN') {
      setShowAdminTab(true);
      setUserPhone(''); // Clear input after triggering
    }
  }, [userPhone]);

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setIsLoading(true);

    if (isLoginView) {
      const foundUser = users.find(user => user.phone === userPhone && user.password === userPassword);
      if (foundUser) {
        if (!Array.isArray(foundUser.stores) && !foundUser.isAdmin) {
          setUserError('أنت مسجل كموظف. يرجى تسجيل الدخول من صفحة دخول الموظفين.');
          setIsLoading(false);
          return;
        }
        onPasswordSuccess(foundUser);
      } else {
        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
        setIsLoading(false);
      }
    } else {
      if (!fullName.trim() || !userPhone.trim() || !userPassword.trim() || !userEmail.trim()) {
        setUserError('يرجى ملء جميع الحقول.');
        setIsLoading(false);
        return;
      }
      if (userPassword.length < 8) {
        setUserError('يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.');
        setIsLoading(false);
        return;
      }
      
      if (users.some(user => user.phone === userPhone)) {
          setUserError('هذا الرقم مسجل بالفعل.');
          setIsLoading(false);
          return;
      }
      if (users.some(user => user.email === userEmail)) {
        setUserError('هذا البريد الإلكتروني مسجل بالفعل.');
        setIsLoading(false);
        return;
      }

      const newUser: User = { fullName, phone: userPhone, password: userPassword, email: userEmail, stores: [], joinDate: new Date().toISOString() };
      setUsers(prevUsers => [...prevUsers, newUser]);
      onPasswordSuccess(newUser);
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setIsLoading(true);
    const adminUser = users.find(user => user.phone === adminPhone && user.isAdmin);

    if (adminUser && adminPassword === adminUser.password) {
        onPasswordSuccess(adminUser);
    } else {
        setAdminError('بيانات دخول المدير غير صحيحة.');
        setIsLoading(false);
    }
  };

  const toggleView = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsLoginView(!isLoginView);
    setUserError('');
    setFullName('');
    setUserPhone('');
    setUserEmail('');
    setUserPassword('');
  };
  
  const navItemClasses = "font-bold text-slate-300 hover:text-white transition-colors";

  return (
    <div dir="rtl" className="font-cairo bg-slate-950 text-white overflow-x-hidden">
      
      {/* --- Header --- */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/70 backdrop-blur-lg border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="font-black text-2xl">منصتي</Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className={navItemClasses}>الميزات</a>
            <a href="#pricing" className={navItemClasses}>الأسعار</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => openAuthModal(true)} className="font-bold text-sm text-slate-300 hover:text-white">تسجيل الدخول</button>
            <button onClick={() => openAuthModal(false)} className="bg-indigo-600 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
              ابدأ الآن
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* --- Hero Section --- */}
        <section className="relative pt-40 pb-24 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 to-slate-950 opacity-50"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,_rgba(129,_140,_248,_0.15),_transparent_40%)] -z-10"></div>
          
          <div className="container mx-auto px-6 relative z-10">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="text-4xl md:text-6xl font-black leading-tight"
            >
              أنشئ متجرك الإلكتروني الاحترافي في دقائق
            </motion.h1>
            <motion.p 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-slate-300 max-w-2xl mx-auto mt-6"
            >
              منصة متكاملة لإدارة المنتجات، الطلبات، والعملاء بسهولة. ابدأ مجاناً، بدون عمولات على المبيعات.
            </motion.p>
            <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-10"
            >
              <button onClick={() => openAuthModal(false)} className="bg-indigo-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 transition-transform hover:scale-105 shadow-2xl shadow-indigo-600/30">
                أنشئ متجرك مجاناً
              </button>
            </motion.div>
          </div>
        </section>

        {/* --- Features Section --- */}
        <section id="features" className="py-24 bg-slate-900">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl font-black">كل ما تحتاجه لتبدأ البيع أونلاين</h2>
              <p className="text-slate-400 mt-4">نقدم لك مجموعة من الأدوات القوية لمساعدتك على النجاح في تجارتك الإلكترونية.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard icon={<Store />} title="متجر إلكتروني متكامل" description="واجهة عرض احترافية لمنتجاتك مع تجربة شراء سهلة لعملائك." />
              <FeatureCard icon={<ShoppingCart />} title="إدارة الطلبات" description="نظام متكامل لتتبع الطلبات من التأكيد وحتى التحصيل." />
              <FeatureCard icon={<BarChart />} title="تحليلات وتقارير" description="احصل على رؤى دقيقة حول مبيعاتك وأرباحك لاتخاذ قرارات أفضل." />
              <FeatureCard icon={<Users />} title="إدارة العملاء" description="سجل بيانات عملائك وتاريخ طلباتهم لتحسين علاقتك بهم." />
              <FeatureCard icon={<Settings />} title="تخصيص كامل" description="تحكم كامل في إعدادات الشحن، الدفع، والسياسات المالية لمتجرك." />
              <FeatureCard icon={<UserPlus />} title="صلاحيات الموظفين" description="أضف فريق عملك وحدد صلاحيات كل موظف بدقة وأمان." />
            </div>
          </div>
        </section>

        {/* --- How It Works Section --- */}
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl font-black">ابدأ في 3 خطوات بسيطة</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                    <StepCard number="01" title="أنشئ حسابك" description="سجل حسابك المجاني في أقل من دقيقة واحدة." />
                    <StepCard number="02" title="أضف منتجاتك" description="أضف صور ووصف منتجاتك بسهولة تامة." />
                    <StepCard number="03" title="ابدأ البيع" description="شارك رابط متجرك مع عملائك وابدأ في استقبال الطلبات." />
                </div>
            </div>
        </section>

        {/* --- Pricing Section --- */}
        <section id="pricing" className="py-24 bg-slate-900">
          <div className="container mx-auto px-6">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-10 rounded-3xl text-center max-w-4xl mx-auto shadow-2xl">
              <h3 className="text-4xl font-black">الخطة المجانية. مدى الحياة.</h3>
              <p className="text-indigo-200 mt-4 text-lg">نحن نؤمن بدعم المشاريع الناشئة. لهذا، منصتنا مجانية بالكامل.</p>
              <ul className="mt-8 space-y-3 text-indigo-100 max-w-md mx-auto">
                <li className="flex items-center justify-center gap-2 font-bold"><CheckCircle className="text-green-400"/> عدد لا محدود من المنتجات</li>
                <li className="flex items-center justify-center gap-2 font-bold"><CheckCircle className="text-green-400"/> عدد لا محدود من الطلبات</li>
                <li className="flex items-center justify-center gap-2 font-bold"><CheckCircle className="text-green-400"/> 0% عمولة على المبيعات</li>
              </ul>
              <button onClick={() => openAuthModal(false)} className="mt-10 bg-white text-indigo-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-indigo-100 transition-transform hover:scale-105">
                ابدأ رحلتك الآن
              </button>
            </div>
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section className="py-24 text-center">
            <div className="container mx-auto px-6">
                <h2 className="text-4xl font-black">جاهز لبدء مشروعك؟</h2>
                <p className="text-slate-400 mt-4">انضم لآلاف التجار الذين يستخدمون منصتنا لتحقيق النجاح.</p>
                <button onClick={() => openAuthModal(false)} className="mt-8 bg-indigo-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 transition-transform hover:scale-105 shadow-2xl shadow-indigo-600/30 flex items-center gap-3 mx-auto">
                    <span>أنشئ متجرك مجاناً</span>
                    <ArrowLeft />
                </button>
            </div>
        </section>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center text-slate-500">
          <p>
            تم تأسيس وبرمجة المنصة بالكامل بواسطة <span className="font-bold text-slate-400">عبدالرحمن سعيد</span>.
          </p>
        </div>
      </footer>

      {/* --- Auth Modal --- */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)}>
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex bg-slate-800/50 border border-slate-700 rounded-lg p-1 mb-6">
                <button onClick={() => setActiveTab('user')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'user' ? 'bg-slate-700/50 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/20'}`}><UserIcon size={16}/> المستخدمين</button>
                {showAdminTab && (
                  <button onClick={() => setActiveTab('admin')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-slate-700/50 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/20'}`}><ShieldAlert size={16}/> المدير</button>
                )}
            </div>
            
            {activeTab === 'user' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{isLoginView ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h2>
                  <p className="text-slate-400 mt-1">{isLoginView ? 'مرحباً بعودتك! أدخل بياناتك للمتابعة.' : 'ابدأ بإنشاء متجرك الإلكتروني الآن'}</p>
                </div>
                <form onSubmit={handleUserSubmit} className="space-y-4 mt-6">
                  {!isLoginView && (
                    <>
                      <div className="relative"><UserIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" placeholder="الاسم الكامل" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                      <div className="relative"><Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="email" placeholder="البريد الإلكتروني" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} /></div>
                    </>
                  )}
                  <div className="relative"><Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" placeholder="رقم الموبايل / اسم المستخدم" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} /></div>
                  <div className="relative"><KeyRound size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="password" placeholder="كلمة المرور" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} /></div>
                  {userError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-sm">{userError}</div>}
                  <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                      {isLoading ? <Loader2 className="animate-spin" /> : (isLoginView ? <><LogIn size={18}/> تسجيل الدخول</> : <><UserPlus size={18}/> إنشاء حساب</>)}
                  </button>
                </form>
                <p className="text-center text-sm text-slate-400 mt-6">{isLoginView ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}{' '}<a href="#" onClick={toggleView} className="font-bold text-indigo-400 hover:underline">{isLoginView ? 'أنشئ حساباً' : 'تسجيل الدخول'}</a></p>
                <div className="mt-4 text-center"><Link to="/employee-login" className="text-sm text-slate-400 hover:text-indigo-400 hover:underline">تسجيل دخول الموظفين</Link></div>
              </div>
            )}
            {activeTab === 'admin' && (
              <div className="animate-in fade-in duration-300">
                 <div className="text-center"><h2 className="text-2xl font-bold">لوحة تحكم المدير</h2><p className="text-slate-400 mt-1">تسجيل دخول خاص بالإدارة.</p></div>
                 <form onSubmit={handleAdminSubmit} className="space-y-4 mt-6">
                  <div className="relative"><Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" required value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div className="relative"><KeyRound size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                   {adminError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-sm">{adminError}</div>}
                   <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                      {isLoading ? <Loader2 className="animate-spin"/> : <><LogIn size={18}/> الدخول كمدير</>}
                   </button>
                 </form>
              </div>
            )}
          </div>
        </AuthModal>
      )}
    </div>
  );
};

export default SignUpPage;