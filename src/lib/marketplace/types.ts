// Response shapes for the marketplace seller API (hand-off §3–§11, §17). Fields the server may omit are optional;
// the app never trusts a field to exist without a fallback.

export type Option = { value: string; label: string };
export type Json = Record<string, any>;
export type Tone = 'green' | 'blue' | 'amber' | 'violet' | 'red';

export type StoreRole = 'owner' | 'manager' | 'inventory' | 'fulfillment';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type AccessBlockReason = 'MERCHANT_PENDING_APPROVAL' | 'MERCHANT_SUSPENDED' | 'MERCHANT_REJECTED' | null;

export interface Address { streetAddress?: string; locality?: string; city?: string; state?: string; pinCode?: string; country?: string }
export interface OperatingHours { openTime?: string; closeTime?: string; isOpenSundays?: boolean }
export interface BankDetails { accountNumber?: string; ifscCode?: string; beneficiaryName?: string; bankName?: string }
export interface Pagination { page: number; limit: number; total: number; totalPages: number }

export interface MerchantSummary {
  id: string; storeName: string; slug?: string; logoUrl?: string; approvalStatus: ApprovalStatus; isActive?: boolean; rejectionReason?: string;
}

export interface StoreStatus {
  success?: boolean; phoneVerified: boolean; isMerchant: boolean; isOwner: boolean; hasPendingInvite: boolean;
  storeRole: StoreRole | null; canAccessDashboard: boolean; accessBlockedReason: AccessBlockReason; merchant: MerchantSummary | null;
}

export interface Store extends Json {
  _id?: string; id?: string; storeName: string; businessName?: string; businessId?: string; slug?: string; description?: string;
  phone?: string; whatsappNumber?: string; email?: string; logoUrl?: string; bannerUrl?: string; address?: Address;
  businessCategories?: string[]; businessType?: string; legalStatus?: string; yearEstablished?: number; employeeCount?: string;
  annualTurnover?: string; ordersFulfilled?: string; iecCode?: string; capabilities?: string[]; serviceAreas?: string[]; certifications?: string[];
  operatingHours?: OperatingHours; bankDetails?: BankDetails; leadAlerts?: { email?: boolean; sms?: boolean };
  approvalStatus?: ApprovalStatus; staff?: StaffMember[]; responseStats?: Json;
}

export interface StaffMember { id?: string; _id?: string; fullName?: string; name?: string; phone?: string; email?: string; role?: StoreRole; status?: string }

export interface DashboardMetrics {
  kpis?: { totalRevenue?: number; activeOrdersCount?: number; needsActionCount?: number; totalListedProducts?: number; lowStockCount?: number };
  pipelineValue?: number; outOfStockCount?: number; draftProducts?: number; orderTabs?: Record<string, number>;
}

export interface Product extends Json {
  _id: string; title: string; brand?: string; sku?: string; description?: string; category?: string; subcategory?: string;
  priceType?: 'fixed' | 'range' | 'on_request'; mrp?: number; sellingPrice?: number; priceMax?: number; discountPercentage?: number;
  unit?: string; unitLabel?: string; gstPercentage?: number; priceIncludesTax?: boolean; stockQuantity?: number; minOrderQuantity?: number;
  maxOrderQuantity?: number; lowStockThreshold?: number; inStock?: boolean; isLowStock?: boolean; status?: 'published' | 'draft' | 'archived';
  photos?: string[]; tags?: string[]; isFeatured?: boolean; leadTimeDays?: number; deliveryLocations?: string[]; bulkSupply?: boolean; customization?: boolean;
  supplyAbility?: { quantity?: number; unit?: string; period?: string }; specifications?: Json;
}

export interface Quotation extends Json {
  _id?: string; unitPrice: number; priceUnit?: string; quantity?: number; totalAmount?: number; gstIncluded?: boolean; gstPercentage?: number;
  deliveryCharges?: number; deliveryDays?: number; validUntil?: string; paymentTerms?: string; notes?: string; status?: string; createdAt?: string;
}

export interface Lead extends Json {
  _id: string; buyerName?: string; buyerPhone?: string; buyerEmail?: string; productId?: { _id?: string; title?: string; brand?: string; photos?: string[] } | null;
  requirementTitle?: string; quantity?: number; unit?: string; deliveryLocation?: string; requiredBy?: string; requirements?: string; message?: string;
  answers?: { question: string; answer: string }[]; merchantNote?: string; status: string; firstRespondedAt?: string; createdAt?: string; quotations?: Quotation[];
}

export interface EnquiryQuestion { _id?: string; label: string; type: string; options?: string[]; required?: boolean }
export interface Review extends Json { _id?: string; rating?: number; comment?: string; buyerName?: string; productId?: { title?: string }; createdAt?: string }
export interface Order extends Json { _id: string; orderNumber?: string; status: string; pricing?: Json; shippingAddress?: Json; items?: Json[]; createdAt?: string }
export interface ReturnRequest extends Json { _id: string; status: string; reason?: string; reasonNote?: string; orderNumber?: string; photos?: string[] }

export interface ListResponse<T> { items: T[]; pagination?: Pagination; counts?: Record<string, number> }
export interface BulkResult { created?: number; skipped?: number; failed?: { row: number; title?: string; message: string }[]; total?: number }
export interface UploadedImage { id: string; url: string; thumbnailUrl?: string; mediumUrl?: string; largeUrl?: string }

export interface TaxonomyCategory { name: string; subcategories: string[] }
