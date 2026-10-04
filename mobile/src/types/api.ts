export interface ApiCategory {
  id: string;
  name: string;
  slug?: string;
}

export interface ApiMedia {
  id?: string;
  url: string;
  fileType?: string;
}

export interface ApiStaff {
  id: string;
  fullName: string;
  professionalTitle?: string;
  position?: string;
  avatarUrl?: string | null;
  rating?: number;
  ratingCount?: number;
  averageRating?: number;
  specialties?: string[];
}

export interface ApiServiceVariant {
  id: string;
  name: string;
  priceType: 'FIXED' | 'FROM' | 'RANGE' | 'QUOTE' | string;
  price?: number | string | null;
  maxPrice?: number | string | null;
  priceDisplay?: string;
  durationMinutes?: number | null;
  maxDurationMinutes?: number | null;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  consultationRequired?: boolean;
  status?: string;
}

export interface ApiService {
  id: string;
  branchId: string;
  name: string;
  description?: string | null;
  price: number | string;
  priceDisplay?: string;
  duration?: number;
  durationMinutes: number;
  categoryId?: string;
  category?: ApiCategory;
  status?: string;
  bookable?: boolean;
  stylists?: string[];
  staffServices?: Array<{ staff: ApiStaff }>;
  images?: Array<{ media: ApiMedia }>;
  variants?: ApiServiceVariant[];
  branch?: {
    id: string;
    name: string;
    businessId: string;
    business?: { id: string; name: string };
  };
}

export interface ApiBranchSummary {
  id: string;
  businessId: string;
  name: string;
  branch_name?: string;
  address?: string | null;
  category?: string;
  categories?: ApiCategory[];
  district?: string;
  districtId?: string | null;
  rating?: number | string;
  services?: number;
  bookings?: number;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  status?: string;
}

export interface ApiBranchDetail {
  id: string;
  businessId: string;
  name: string;
  addressLine?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  phone?: string | null;
  district?: {
    id: string;
    name: string;
    province?: { id: string; name: string };
  } | null;
  business?: {
    id: string;
    name: string;
    slug?: string;
    description?: string | null;
    contactPhone?: string | null;
  };
  workingHours?: Array<{
    dayOfWeek: number;
    isClosed?: boolean;
    openTime?: string;
    closeTime?: string;
  }>;
  images?: Array<{ id?: string; sortOrder?: number; media: ApiMedia }>;
  services?: ApiService[];
  staff?: ApiStaff[];
}

export interface ApiComboService {
  serviceId?: string;
  quantity?: number;
  sortOrder?: number;
  service: ApiService;
}

export interface ApiCombo {
  id: string;
  branchId: string;
  businessId?: string;
  name: string;
  description?: string | null;
  comboPrice: number | string;
  originalPrice: number | string;
  durationMinutes: number;
  savingAmount?: number | string;
  discountPercentage?: number | string;
  branch: { id: string; name: string; businessId: string };
  comboServices: ApiComboService[];
  images?: Array<{ media: ApiMedia }>;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface ApiSearchService {
  id: string;
  branchId: string;
  businessId: string;
  displayName: string;
  description?: string | null;
  price: number | string;
  durationMinutes: number;
  branchName: string;
  businessName: string;
  address?: string | null;
  districtName?: string | null;
  provinceName?: string | null;
  categoryName?: string | null;
  canonicalServiceId?: string | null;
  canonicalServiceName?: string | null;
  rating: number | string;
  reviewCount: number | string;
  availableStaffCount: number | string;
}

export interface ApiSearchResponse {
  data: ApiSearchService[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiAuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions?: string[];
  workspace?: string;
}

export interface ApiAuthResponse {
  user: ApiAuthUser;
  accessToken: string;
  refreshToken?: string;
}

export interface ApiBookingService {
  id: string;
  staffId?: string | null;
  variantId?: string | null;
  priceAtBooking: number | string;
  durationMinutes: number;
  service?: { id: string; name: string; description?: string | null };
  staff?: ApiStaff;
}

export interface ApiBooking {
  id: string;
  bookingCode?: string;
  status: string;
  appointmentDate: string;
  appointmentStartTime: string;
  appointmentEndTime?: string;
  totalAmount?: number | string;
  finalAmount?: number | string;
  note?: string | null;
  branch?: {
    id: string;
    name: string;
    addressLine?: string | null;
    phone?: string | null;
    business?: { id: string; name: string };
  };
  bookingServices?: ApiBookingService[];
  review?: { id: string; overallRating?: number; comment?: string | null } | null;
  changeRequests?: Array<{
    id: string;
    requestType: string;
    status: string;
    reason?: string | null;
    createdAt?: string;
    expiresAt?: string | null;
  }>;
}

export interface ApiAvailableSlot {
  start: string;
  end: string;
}

export interface ApiAvailableSlotsResponse {
  branchId?: string;
  date?: string;
  totalDuration?: number;
  staffCount?: number;
  slots: ApiAvailableSlot[];
  message?: string;
}

export interface ApiPricePreview {
  subtotal: number;
  promotionDiscount?: number;
  voucherApplied?: boolean;
  code?: string;
  voucherDiscount?: number;
  finalAmount: number;
  explanations?: string[];
}

export interface ApiCreateReviewInput {
  bookingId: string;
  overallRating: number;
  comment?: string;
  isAnonymous?: boolean;
  serviceRatings?: Array<{
    bookingServiceId: string;
    staffId?: string;
    rating: number;
    comment?: string;
  }>;
}

export interface ApiReview {
  id: string;
  overallRating: number;
  comment?: string | null;
  createdAt: string;
  customerName: string;
  appointmentDate?: string | null;
}

export interface ApiReviewResponse {
  data: ApiReview[];
  summary?: { averageRating: number; totalReviews: number };
}
