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
}

export interface ServiceGroup {
  name: string;
  items: ServiceItem[];
}

export interface StaffMember {
  id: string;
  name: string;
}

export interface Review {
  id: string;
  reviewerName: string;
  date: string;
  score: number;
  text: string;
}

export const formatCurrency = (value: number): string => `${value.toLocaleString('vi-VN')} đ`;
