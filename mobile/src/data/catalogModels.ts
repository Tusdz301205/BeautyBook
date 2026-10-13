export type IconLib = 'ionicons' | 'mci';

export interface Category {
  id: string;
  label: string;
  icon: string;
  lib: IconLib;
}

export type TagType = 'Booking' | 'Review';

export interface Venue {
  id: string;
  name: string;
  address: string;
  rating: number;
  tag: TagType;
  distanceKm: number;
  hasHourlyPromo: boolean;
  logoText: string;
}

export interface Combo {
  id: string;
  title: string;
  shopName: string;
  discountPercent: number;
  price: number;
  originalPrice: number;
  logoText: string;
  duration: string;
  address: string;
  hours: string;
  rating: number;
  steps: string[];
  terms: string[];
}

export interface BannerSlide {
  id: string;
  imageUri: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  duration: string;
  price: number;
  /** fixed: one price; from: lowest bookable variant; quote: consultation only. */
  priceKind?: 'fixed' | 'from' | 'quote';
  priceDisplay?: string;
}

export interface ServiceGroup {
  name: string;
  items: ServiceItem[];
}

export interface StaffMember {
  id: string;
  name: string;
  /** Public profile fields from the branch detail API; all optional. */
  title?: string;
  specialties?: string[];
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
}

export interface Review {
  id: string;
  reviewerName: string;
  date: string;
  score: number;
  text: string;
}

export const formatCurrency = (value: number): string => `${value.toLocaleString('vi-VN')} đ`;

/** Customer-facing price that preserves FIXED / FROM / QUOTE semantics. */
export function servicePriceLabel(item: Pick<ServiceItem, 'price' | 'priceKind' | 'priceDisplay'>): string {
  if (item.priceDisplay) return item.priceDisplay;
  if (item.priceKind === 'quote') return 'Cần tư vấn';
  if (!Number.isFinite(item.price) || item.price <= 0) return 'Liên hệ cơ sở';
  return item.priceKind === 'from' ? `Từ ${formatCurrency(item.price)}` : formatCurrency(item.price);
}

/** Display order only: groups and services the customer arrived with lead the list; everything else keeps its order. */
export function leadWithRequested<T extends { id: string }, G extends { items: T[] }>(groups: G[], requestedIds: string[]): G[] {
  if (requestedIds.length === 0) return groups;
  const wanted = new Set(requestedIds);
  const rank = (items: T[]) => Number(items.some((item) => wanted.has(item.id)));
  return groups
    .map((group) => ({ ...group, items: [...group.items].sort((a, b) => rank([b]) - rank([a])) }))
    .sort((a, b) => rank(b.items) - rank(a.items));
}
