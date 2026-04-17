
// ... (previous imports and declartions)

// FIX: Declaring the 'google' object in the global scope to make it accessible across all files.
declare global {
  const google: {
    script: {
      run: {
        withSuccessHandler(handler: (response: any) => void): any;
        withFailureHandler(handler: (error: Error) => void): any;
        serverApiCall(storeId: string, action: string, payload: any | null): void;
      };
    };
  };
}

export type OrderStatus = 'في_انتظار_المكالمة' | 'جاري_المراجعة' | 'قيد_التنفيذ' | 'تم_الارسال' | 'قيد_الشحن' | 'تم_توصيلها' | 'تم_التحصيل' | 'مرتجع' | 'مرتجع_جزئي' | 'فشل_التوصيل' | 'ملغي' | 'مؤرشف' | 'مرتجع_بعد_الاستلام' | 'تم_الاستبدال';
export type PaymentStatus = 'بانتظار الدفع' | 'مدفوع' | 'مدفوع جزئياً' | 'مرتجع';
export type PreparationStatus = 'بانتظار التجهيز' | 'جاهز';

export interface CityOption {
  id: string;
  name: string;
  shippingPrice: number;
  extraKgPrice: number;
  returnAfterPrice: number;
  returnWithoutPrice: number;
  exchangePrice: number;
  useParentFees?: boolean; // New flag for price inheritance
  active?: boolean; // New flag for soft delete/deactivation
}

export interface ShippingOption {
  id: string;
  label: string;      
  details: string;    
  price: number;      
  extraKgPrice: number; 
  returnAfterPrice: number;   
  returnWithoutPrice: number; 
  exchangePrice: number;      
  baseWeight: number;
  cities?: CityOption[];
  active?: boolean; // New flag for soft delete/deactivation
}

export interface PlatformIntegration {
  platform: 'none' | 'wuilt';
  apiKey: string;
  shopId?: string;
  shopUrl?: string;
}

export interface ShippingCarrierIntegration {
  id: string;
  provider: 'bosta' | 'mylerz' | 'aramex_api' | 'turbo';
  apiKey: string;
  apiSecret?: string;
  accountNumber?: string;
  isConnected: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  costPrice?: number;
  weight?: number;
  stock?: number;
  stockQuantity: number | null;
  options: { [optionName: string]: string };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  weight: number;
  costPrice: number;
  thumbnail?: string;
  images?: string[];
  inStock?: boolean;
  stock?: number;
  stockQuantity: number | null;
  collectionId?: string; 
  hasVariants: boolean;
  options: string[];
  variants: ProductVariant[];
  
  // For profit calculation
  useProfitPercentage?: boolean; // Legacy, will be phased out
  profitPercentage?: number;     // For margin mode

  profitMode?: 'manual' | 'margin' | 'commission';
  basePrice?: number;
  commissionPercentage?: number;
  stockThreshold?: number;
}

export type TransactionCategory = 'shipping' | 'insurance' | 'inspection' | 'collection' | 'cod' | 'return' | 'manual_deposit' | 'manual_withdrawal' | 'expense_ads' | 'expense_salary' | 'expense_rent' | 'expense_other' | 'inventory_purchase';

export interface Transaction {
  id: string;
  type: 'إيداع' | 'سحب';
  amount: number;
  date: string;
  note: string;
  category?: TransactionCategory;
}

export interface Wallet {
  balance: number;
  transactions: Transaction[];
}

export interface CompanyFees {
  insuranceFeePercent: number;
  inspectionFee: number;
  returnShippingFee: number;
  useCustomFees: boolean;
  defaultInspectionActive: boolean; 
  enableReturnAfter: boolean;    
  enableReturnWithout: boolean;  
  enableExchange: boolean;       
  enableFixedReturn: boolean;    
  baseWeight?: number;
  enableCodFees: boolean;
  codThreshold: number;
  codFeeRate: number;
  codTaxRate: number;
  postCollectionReturnRefundsProductPrice: boolean;
}

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  ORDERS_VIEW: 'ORDERS_VIEW',
  ORDERS_MANAGE: 'ORDERS_MANAGE',
  PRODUCTS_VIEW: 'PRODUCTS_VIEW',
  PRODUCTS_MANAGE: 'PRODUCTS_MANAGE',
  WALLET_VIEW: 'WALLET_VIEW',
  WALLET_MANAGE: 'WALLET_MANAGE',
  SETTINGS_VIEW: 'SETTINGS_VIEW',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  permissions: Permission[];
  status?: 'active' | 'invited' | 'pending';
}

export interface StoreSection {
  id: string;
  type: 'hero' | 'products';
  enabled: boolean;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  link?: string;
}

export interface StoreCustomization {
  logoUrl: string;
  faviconUrl: string;
  logoSize: 'sm' | 'md' | 'lg';
  banners: Banner[];
  footerText: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: 'Cairo' | 'Readex Pro' | 'Tajawal';
  headingFontWeight: 'font-bold' | 'font-black';
  bodyFontSize: 'text-sm' | 'text-base' | 'text-lg';
  announcementBarText: string;
  isAnnouncementBarVisible: boolean;
  socialLinks: {
    facebook: string;
    instagram: string;
    x: string;
    tiktok: string;
  };
  pageSections: StoreSection[];
  buttonBorderRadius: 'rounded-none' | 'rounded-md' | 'rounded-lg' | 'rounded-full';
  cardStyle: 'default' | 'elevated' | 'outlined';
  productColumnsDesktop: 2 | 3 | 4 | 5;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  active: boolean;
  usageCount: number;
}

export interface AbandonedCart {
  id: string;
  customerName: string;
  customerPhone: string;
  date: string;
  items: OrderItem[];
  totalValue: number;
}

export interface CustomerProfile {
  id: string; 
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  successfulOrders: number;
  returnedOrders: number;
  totalSpent: number; 
  lastOrderDate: string;
  firstOrderDate: string;
  averageOrderValue: number;
  loyaltyPoints: number;
  notes?: string;
}

export interface Review {
  id: string;
  productId: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export interface SupplyOrder {
  id: string;
  supplierId: string;
  date: string;
  items: { productId: string; quantity: number; cost: number }[];
  totalCost: number;
  status: 'completed';
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  details: string;
  date: string;
  timestamp: number;
}

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string; 
  details: string;
  instructions: string;
  logoUrl?: string;
  active: boolean;
  type: 'cod' | 'manual';
}

export interface GlobalOption {
  id: string;
  name: string;
  values: string[];
}

export interface Collection {
  id: string;
  name: string;
  image?: string;
  description?: string;
}

export interface WhatsAppTemplate {
  id: string;
  label: string;
  text: string;
}

export interface CallScript {
  id: string;
  title: string;
  text: string;
}

export interface EmployeeDashboardSettings {
  showAssignedOrders: boolean;
  showOrderStatuses: OrderStatus[];
  showFollowUpReminders: boolean;
}

export interface WebhookIntegration {
  id: string;
  storeUrl: string;
  webhookUrl: string;
  secretKey: string;
  isActive: boolean;
}

export interface Settings {
  enableGlobalFinancials: boolean; 
  webhookIntegrations?: WebhookIntegration[];
  insuranceFeePercent: number;
  enableInsurance: boolean; 
  inspectionFee: number;
  enableInspection: boolean; 
  returnShippingFee: number;
  enableReturnShipping: boolean; 
  enableReturnAfterPrice: boolean;
  enableReturnWithoutPrice: boolean;
  enableExchangePrice: boolean;
  baseWeight?: number;
  products: Product[];
  shippingOptions: Record<string, ShippingOption[]>;
  activeCompanies: Record<string, boolean>;
  exchangeSupported: Record<string, boolean>;
  companySpecificFees: Record<string, CompanyFees>; 
  enableGlobalCod: boolean; 
  codThreshold: number;
  codFeeRate: number;
  codTaxRate: number;
  sku: string; 
  defaultProductPrice: number;
  enableDefaultPrice: boolean;
  enablePlatformIntegration: boolean;
  integration: PlatformIntegration;
  customAppDomain?: string; // <-- New field for SaaS integration
  platformConfigs?: Record<string, {
    appId: string;
    apiKey?: string;
    apiSecret?: string;
    shopUrl?: string;
    shopId?: string;
    lastSync?: string;
    lastProductSync?: string;
    isActive: boolean;
  }>;
  employees: Employee[];
  customization: StoreCustomization;
  discountCodes: DiscountCode[];
  abandonedCarts: AbandonedCart[];
  reviews: Review[]; 
  shippingIntegrations: ShippingCarrierIntegration[];
  suppliers: Supplier[];
  supplyOrders: SupplyOrder[];
  activityLogs: ActivityLog[];
  customPages: CustomPage[];
  paymentMethods: PaymentMethod[];
  globalOptions: GlobalOption[]; 
  collections: Collection[];
  connectedPlatforms: string[]; // <-- Added connected platforms (e.g., 'wuilt', 'shopify')
  whatsappTemplates?: WhatsAppTemplate[];
  callScripts?: CallScript[];
  employeeDashboardSettings?: EmployeeDashboardSettings;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
  weight: number;
  thumbnail?: string;
  variantId?: string;
  variantDescription?: string;
}

export interface ConfirmationLog {
  userId: string;
  userName: string;
  timestamp: string;
  action: string;
  notes?: string;
  duration?: number; // Call duration in seconds
}

export interface CallAttempt {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  status: string;
  notes?: string;
  duration?: number;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action?: string;
  details?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  waybillNumber?: string;
  date: string;
  shippingCompany: string;
  shippingArea: string;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  customerAddress: string;
  city?: string;
  governorate?: string;
  notes?: string;
  items: OrderItem[];
  shippingFee: number;
  status: OrderStatus;
  productName: string; 
  productPrice: number; 
  productCost: number; 
  weight: number; 
  discount: number;
  totalAmountOverride?: number;
  totalAmountOverrideReason?: string;
  includeInspectionFee: boolean; 
  isInsured: boolean; 
  inspectionFeeDeducted?: boolean;
  inspectionFeePaidByCustomer?: boolean;
  shippingAndInsuranceDeducted?: boolean;
  returnFeeDeducted?: boolean;
  collectionProcessed?: boolean;
  paymentStatus: PaymentStatus;
  preparationStatus: PreparationStatus;
  classification?: string;
  paymentMethod?: string;
  redeemedPoints?: number;
  pointsDiscount?: number;
  loyaltyPointsAwarded?: boolean;
  orderType?: 'standard' | 'exchange';
  originalOrderId?: string;
  confirmationLogs?: ConfirmationLog[];
  cancellationReason?: string;
  followUpReminder?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  transferStatus?: 'pending' | 'accepted' | 'rejected';
  transferTo?: string;
  transferFrom?: string;
  assignedTo?: string;
  assignedToName?: string;
  auditLogs?: AuditLog[];
  callAttempts?: CallAttempt[];
  sentiment?: string;
}

export interface StoreData {
  orders: Order[];
  settings: Settings;
  wallet: Wallet;
  cart: OrderItem[];
  customers: CustomerProfile[]; // Added customers to StoreData
}

export interface PlaceOrderData {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    shippingCompany: string;
    shippingArea: string;
    shippingFee: number;
    notes?: string;
    redeemedPoints: number;
    discount: number;
}

export interface Store {
  id: string;
  name: string;
  specialization: string;
  language: string;
  currency: string;
  url: string;
  creationDate: string;
}

export interface Site {
  id: string;
  name: string;
  type: 'business' | 'ecommerce';
  url: string;
}

export interface User {
  name?: string;
  fullName: string;
  phone: string;
  password: string;
  email: string;
  stores?: Store[];
  sites?: Site[];
  isAdmin?: boolean; 
  isBanned?: boolean; 
  joinDate?: string;
}

export interface Invitation {
  storeId: string;
  storeName: string;
  inviterName: string;
}

export interface JoinRequest {
  storeId: string;
  storeName: string;
  employeeId: string;
  employeeName: string;
}

export interface ChatMessage {
  id: number;
  store_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  is_file?: boolean;
}
