
import { Settings, PERMISSIONS, StoreCustomization } from './types';

const INITIAL_CUSTOMIZATION: StoreCustomization = {
  logoUrl: '',
  faviconUrl: '',
  logoSize: 'md',
  banners: [
    {
        id: 'banner-1',
        imageUrl: 'https://picsum.photos/1600/500?random=1',
        title: 'أهلاً بك في متجرنا!',
        subtitle: 'اكتشف أفضل المنتجات بأفضل الأسعار.',
        buttonText: 'تصفح المنتجات',
        link: '#products-section'
    }
  ],
  footerText: `© ${new Date().getFullYear()} جميع الحقوق محفوظة.`,
  primaryColor: '#4f46e5', // indigo-600
  backgroundColor: '#f8fafc', // slate-50
  textColor: '#0f172a',      // slate-900
  fontFamily: 'Cairo',
  headingFontWeight: 'font-black',
  bodyFontSize: 'text-base',
  announcementBarText: '✨ شحن مجاني للطلبات فوق 500 جنيه! ✨',
  isAnnouncementBarVisible: true,
  socialLinks: {
    facebook: '',
    instagram: '',
    x: '',
    tiktok: '',
  },
  pageSections: [
    { id: 'hero-section', type: 'hero', enabled: true },
    { id: 'products-section', type: 'products', enabled: true },
  ],
  buttonBorderRadius: 'rounded-lg',
  cardStyle: 'elevated',
  productColumnsDesktop: 4,
};


export const INITIAL_SETTINGS: Settings = {
  enableGlobalFinancials: false, 
  insuranceFeePercent: 1, 
  enableInsurance: true,
  inspectionFee: 7,
  enableInspection: true,
  returnShippingFee: 35,
  enableReturnShipping: true,
  enableReturnAfterPrice: true,
  enableReturnWithoutPrice: true,
  enableExchangePrice: true,
  defaultProductPrice: 2100,
  enableDefaultPrice: true,
  sku: 'XP-LZ5-160',
  products: [],
  shippingOptions: {
    'ارامكس': [
      { id: 'z1', label: 'القاهرة والجيزة', details: 'خدمة توصيل سريعة', price: 89, baseWeight: 5, extraKgPrice: 10, returnAfterPrice: 89, returnWithoutPrice: 89, exchangePrice: 129 },
      { id: 'z2', label: 'الإسكندرية', details: 'عروس البحر المتوسط', price: 89, baseWeight: 5, extraKgPrice: 10, returnAfterPrice: 89, returnWithoutPrice: 89, exchangePrice: 129 },
      { id: 'z3', label: 'الدلتا', details: 'محافظات الوجه البحري', price: 89, baseWeight: 5, extraKgPrice: 10, returnAfterPrice: 89, returnWithoutPrice: 89, exchangePrice: 129 },
      { id: 'z4', label: 'الصعيد', details: 'محافظات الوجه القبلي', price: 106, baseWeight: 5, extraKgPrice: 12, returnAfterPrice: 106, returnWithoutPrice: 106, exchangePrice: 155 }
    ]
  },
  activeCompanies: { 'ارامكس': true },
  exchangeSupported: { 'ارامكس': true },
  companySpecificFees: {
    'ارامكس': {
      insuranceFeePercent: 1,
      inspectionFee: 7,
      returnShippingFee: 35,
      useCustomFees: false,
      defaultInspectionActive: true,
      enableCodFees: true,
      codThreshold: 2000,
      codFeeRate: 0.01,
      codTaxRate: 0.14,
      enableReturnAfter: true,
      enableReturnWithout: true,
      enableExchange: true,
      enableFixedReturn: true,
      postCollectionReturnRefundsProductPrice: true,
    }
  },
  enableGlobalCod: true,
  codThreshold: 2000,
  codFeeRate: 0.01,
  codTaxRate: 0.14,
  integration: {
    platform: 'none',
    apiKey: ''
  },
  enablePlatformIntegration: false,
  employees: [],
  customization: INITIAL_CUSTOMIZATION,
  discountCodes: [],
  abandonedCarts: [],
  reviews: [],
  shippingIntegrations: [],
  suppliers: [],
  supplyOrders: [],
  activityLogs: [],
  customPages: [],
  paymentMethods: [
    { id: 'cod', name: 'الدفع عند الاستلام', details: '', instructions: 'الدفع نقداً للمندوب عند استلام الشحنة.', active: true, type: 'cod' }
  ],
  globalOptions: [
      { id: 'opt1', name: 'المقاس', values: ['S', 'M', 'L', 'XL'] },
      { id: 'opt2', name: 'اللون', values: ['أحمر', 'أزرق', 'أسود', 'أبيض'] }
  ],
  collections: []
};

export const ORDER_STATUSES = [
  'في_انتظار_المكالمة',
  'جاري_المراجعة',
  'قيد_التنفيذ', 
  'تم_الارسال', 
  'قيد_الشحن', 
  'تم_توصيلها',
  'تم_التحصيل',
  'مرتجع', 
  'مرتجع_بعد_الاستلام',
  'تم_الاستبدال',
  'مرتجع_جزئي', 
  'فشل_التوصيل', 
  'ملغي',
  'مؤرشف'
] as const;