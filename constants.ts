
import { Settings, PERMISSIONS, StoreCustomization, ShippingOption } from './types';

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

export const EGYPT_GOVERNORATES = [
    { name: "القاهرة", cities: ["مدينة نصر", "مصر الجديدة", "المعادي", "التجمع الخامس", "الرحاب", "مدينتي", "الشروق", "العبور", "بدر", "المقطم", "وسط البلد", "شبرا", "عين شمس", "المطرية", "المرج", "الزيتون", "حدائق القبة", "الوايلي", "الزاوية الحمراء", "الشرابية", "الساحل", "روض الفرج", "بولاق", "منشأة ناصر", "الجمالية", "الدرب الأحمر", "باب الشعرية", "الموسكي", "الأزبكية", "عابدين", "السيدة زينب", "مصر القديمة", "البساتين", "دار السلام", "المعصرة", "حلوان", "التبين", "15 مايو", "الزمالك", "جاردن سيتي", "المنيل", "الفسطاط", "الأميرية", "الحلمية", "طره"] },
    { name: "الجيزة", cities: ["6 أكتوبر", "الشيخ زايد", "الهرم", "فيصل", "الدقي", "المهندسين", "العجوزة", "إمبابة", "الوراق", "بولاق الدكرور", "العمرانية", "الطالبية", "الجيزة", "الحوامدية", "البدرشين", "العياط", "الصف", "أطفيح", "الواحات البحرية", "أوسيم", "كرداسة", "أبو النمرس", "منشأة القناطر", "الحرانية", "سقارة", "ميت رهينة"] },
    { name: "الإسكندرية", cities: ["برج العرب", "برج العرب الجديدة", "المنتزه", "شرق", "وسط", "الجمرك", "غرب", "العجمي", "العامرية", "الرمل", "سيدي جابر", "محرم بك", "اللبان", "العطارين", "المنشية", "كرموز", "الدخيلة", "ميامي", "فيكتوريا", "سموحة", "كفر عبده", "رشدي", "ستانلي"] },
    { name: "القليوبية", cities: ["بنها", "قليوب", "شبرا الخيمة", "القناطر الخيرية", "الخانكة", "كفر شكر", "طوخ", "قها", "العبور", "الخصوص", "شبين القناطر", "مسطرد", "أبو زعبل"] },
    { name: "الدقهلية", cities: ["المنصورة", "طلخا", "ميت غمر", "دكرنس", "أجا", "منية النصر", "السنبلاوين", "الكردي", "بني عبيد", "المنزلة", "تمى الأمديد", "الجمالية", "شربين", "المطرية", "بلقاس", "ميت سلسيل", "جمصة", "محلة دمنة", "نبروه"] },
    { name: "الشرقية", cities: ["الزقازيق", "العشر من رمضان", "منيا القمح", "بلبيس", "مشتول السوق", "القنايات", "أبو حماد", "القرين", "ههيا", "أبو كبير", "فاقوس", "الصالحية الجديدة", "الإبراهيمية", "ديرب نجم", "كفر صقر", "أولاد صقر", "الحسينية", "صان الحجر القبلية", "منشأة أبو عمر", "أولاد صقر"] },
    { name: "الغربية", cities: ["طنطا", "المحلة الكبرى", "كفر الزيات", "زفتى", "السنطة", "قطور", "بسيون", "سمنود"] },
    { name: "المنوفية", cities: ["شبين الكوم", "مدينة السادات", "منوف", "سرس الليان", "أشمون", "الباجور", "قويسنا", "بركة السبع", "تلا", "الشهداء"] },
    { name: "البحيرة", cities: ["دمنهور", "كفر الدوار", "رشيد", "إدكو", "أبو المطامير", "أبو حمص", "الدلنجات", "المحمودية", "الرحمانية", "إيتاي البارود", "حوش عيسى", "شبراخيت", "كوم حمادة", "بدر", "وادي النطرون", "النوبارية الجديدة"] },
    { name: "كفر الشيخ", cities: ["كفر الشيخ", "دسوق", "فوه", "مطوبس", "برج البرلس", "الحامول", "بلطيم", "مصيف بلطيم", "الرياض", "سيدي سالم", "قلين", "سيدي غازي", "بيلا"] },
    { name: "دمياط", cities: ["دمياط", "دمياط الجديدة", "رأس البر", "فارسكور", "الزرقا", "السرو", "الروضة", "كفر البطيخ", "عزبة البرج", "ميت أبو غالب", "كفر سعد"] },
    { name: "بورسعيد", cities: ["بورسعيد", "بورفؤاد", "حي العرب", "حي الضواحي", "حي الزهور", "حي المناخ", "حي الشرق", "حي الجنوب"] },
    { name: "الإسماعيلية", cities: ["الإسماعيلية", "فايد", "القنطرة شرق", "القنطرة غرب", "التل الكبير", "أبو صوير", "القصاصين الجديدة", "مدينة المستقبل"] },
    { name: "السويس", cities: ["السويس", "الأربعين", "عتاقة", "الجناين", "فيصل", "العين السخنة"] },
    { name: "بني سويف", cities: ["بني سويف", "بني سويف الجديدة", "الواسطى", "ناصر", "إهناسيا", "ببا", "الفشن", "سمسطا"] },
    { name: "الفيوم", cities: ["الفيوم", "الفيوم الجديدة", "طامية", "سنورس", "إطسا", "إبشواي", "يوسف الصديق"] },
    { name: "المنيا", cities: ["المنيا", "المنيا الجديدة", "العدوة", "مغاغة", "بني مزار", "مطاي", "سمالوط", "أبو قرقاص", "ملوي", "دير مواس"] },
    { name: "أسيوط", cities: ["أسيوط", "أسيوط الجديدة", "ديروط", "منفلوط", "القوصية", "أبنوب", "أبو تيج", "الغنايم", "ساحل سليم", "البداري", "صدفا", "الفتح"] },
    { name: "سوهاج", cities: ["سوهاج", "سوهاج الجديدة", "أخميم", "أخميم الجديدة", "البلينا", "المراغة", "المنشأة", "دار السلام", "جرجا", "جهينة", "ساقلتة", "طما", "طهطا", "الكوثر"] },
    { name: "قنا", cities: ["قنا", "قنا الجديدة", "أبو تشت", "فرشوط", "نجع حمادي", "الوقف", "دشنا", "قوص", "نقادة", "قفط"] },
    { name: "الأقصر", cities: ["الأقصر", "الأقصر الجديدة", "طيبة الجديدة", "الزينية", "البياضية", "القرنة", "أرمنت", "إسنا"] },
    { name: "أسوان", cities: ["أسوان", "أسوان الجديدة", "دراو", "كوم أمبو", "نصر النوبة", "كلابشة", "إدفو", "الرديسية", "البصيلية", "السباعية", "أبو سمبل السياحية"] },
    { name: "البحر الأحمر", cities: ["الغردقة", "رأس غارب", "سفاجا", "القصير", "مرسى علم", "شلاتين", "حلايب", "الجونة"] },
    { name: "الوادي الجديد", cities: ["الخارجة", "باريس", "موط", "الفرافرة", "بلاط", "الداخلة"] },
    { name: "مطروح", cities: ["مرسى مطروح", "الحمام", "العلمين", "العلمين الجديدة", "الضبعة", "النجيلة", "سيدي براني", "السلوم", "سيوة", "مارينا"] },
    { name: "شمال سيناء", cities: ["العريش", "الشيخ زويد", "رفح", "بئر العبد", "الحسنة", "نخل"] },
    { name: "جنوب سيناء", cities: ["الطور", "شرم الشيخ", "دهب", "نويبع", "طابا", "سانت كاترين", "أبو رديس", "أبو زنيمة", "رأس سدر"] },
];

export const generateEgyptShippingOptions = (): ShippingOption[] => {
  return EGYPT_GOVERNORATES.map((gov, index) => ({
    id: `gov_${index + 1}`,
    label: gov.name,
    details: 'شحن محافظات',
    price: 0, 
    baseWeight: 1,
    extraKgPrice: 0,
    returnAfterPrice: 0,
    returnWithoutPrice: 0,
    exchangePrice: 0,
    cities: gov.cities.map((city, cIndex) => ({
      id: `city_${index + 1}_${cIndex + 1}`,
      name: city,
      shippingPrice: 0,
      extraKgPrice: 0,
      returnAfterPrice: 0,
      returnWithoutPrice: 0,
      exchangePrice: 0,
      useParentFees: true
    }))
  }));
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
    'شحن داخلي': generateEgyptShippingOptions()
  },
  activeCompanies: { 'شحن داخلي': true },
  exchangeSupported: { 'شحن داخلي': true },
  companySpecificFees: {
    'شحن داخلي': {
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
