import type {
  ApiBranchDetail,
  ApiBranchSummary,
  ApiCategory,
  ApiCombo,
  ApiReview,
  ApiSearchService,
  ApiService,
} from '../types/api';
import type {
  Category,
  Combo,
  IconLib,
  Review,
  ServiceGroup,
  ServiceItem,
  StaffMember,
  Venue,
} from '../data/catalogModels';

export type RemoteVenue = Venue & {
  businessId: string;
  branchName?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  imageUrls?: string[];
  openingHours?: string;
};

export type RemoteServiceItem = ServiceItem & {
  branchId: string;
  originalPrice: number;
  categoryId?: string;
};

export type RemoteCombo = Combo & {
  branchId: string;
  serviceIds: string[];
  imageUrls: string[];
};

const categoryIcons: Array<{ icon: string; lib: IconLib }> = [
  { icon: 'leaf-outline', lib: 'ionicons' },
  { icon: 'water-outline', lib: 'ionicons' },
  { icon: 'color-fill-outline', lib: 'ionicons' },
  { icon: 'hair-dryer', lib: 'mci' },
  { icon: 'sparkles-outline', lib: 'ionicons' },
  { icon: 'body-outline', lib: 'ionicons' },
];

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const logoText = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'SPA';

export function mapCategory(category: ApiCategory, index = 0): Category {
  const visual = categoryIcons[index % categoryIcons.length];
  return { id: category.id, label: category.name, ...visual };
}

export function mapBranchSummary(branch: ApiBranchSummary): RemoteVenue {
  return {
    id: branch.id,
    businessId: branch.businessId,
    branchName: branch.branch_name,
    name: branch.name || branch.branch_name || 'Cơ sở làm đẹp',
    address: branch.address || branch.district || 'Chưa cập nhật địa chỉ',
    rating: numberValue(branch.rating),
    tag: numberValue(branch.bookings) > 0 ? 'Booking' : 'Review',
    distanceKm: 0,
    hasHourlyPromo: false,
    logoText: logoText(branch.name || branch.branch_name || 'SPA'),
  };
}

export function mapBranchDetail(branch: ApiBranchDetail): RemoteVenue {
  const name = branch.business?.name || branch.name;
  const todayHours = branch.workingHours?.find((item) => item.dayOfWeek === new Date().getDay());
  const formatTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value.slice(0, 5)
      : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };
  return {
    id: branch.id,
    businessId: branch.businessId,
    branchName: branch.name,
    name,
    address: branch.addressLine || [branch.district?.name, branch.district?.province?.name].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ',
    phone: branch.phone || branch.business?.contactPhone || undefined,
    latitude: branch.latitude == null ? undefined : numberValue(branch.latitude),
    longitude: branch.longitude == null ? undefined : numberValue(branch.longitude),
    imageUrls: branch.images?.map((item) => item.media.url).filter(Boolean) ?? [],
    openingHours: todayHours?.isClosed
      ? 'Hôm nay đóng cửa'
      : todayHours
        ? `${formatTime(todayHours.openTime)} - ${formatTime(todayHours.closeTime)}`
        : 'Chưa cập nhật',
    rating: 0,
    tag: 'Booking',
    distanceKm: 0,
    hasHourlyPromo: false,
    logoText: logoText(name),
  };
}

export function mapService(service: ApiService): RemoteServiceItem {
  const price = numberValue(service.price);
  const duration = service.durationMinutes ?? service.duration ?? 0;
  return {
    id: service.id,
    branchId: service.branchId,
    categoryId: service.categoryId || service.category?.id,
    name: service.name,
    duration: `${duration} phút`,
    price,
    originalPrice: price,
  };
}

export function groupServices(services: ApiService[] = []): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();
  services.forEach((service) => {
    const name = service.category?.name || 'Dịch vụ';
    const group = groups.get(name) ?? { name, items: [] };
    group.items.push(mapService(service));
    groups.set(name, group);
  });
  return [...groups.values()];
}

export function mapStaff(staff: ApiBranchDetail['staff'] = []): StaffMember[] {
  return staff.map((item) => ({ id: item.id, name: item.fullName }));
}

export function mapCombo(combo: ApiCombo, branch?: ApiBranchSummary | ApiBranchDetail | RemoteVenue): RemoteCombo {
  const price = numberValue(combo.comboPrice);
  const originalPrice = numberValue(combo.originalPrice, price);
  const branchName = branch && 'business' in branch
    ? branch.business?.name || branch.name
    : branch?.name || combo.branch.name;
  const address = branch && 'addressLine' in branch
    ? branch.addressLine || ''
    : branch && 'address' in branch
      ? branch.address || ''
      : '';
  const steps = combo.comboServices.map((item) => item.service.name);
  const terms = [
    combo.validTo ? `Áp dụng đến ${new Date(combo.validTo).toLocaleDateString('vi-VN')}` : 'Áp dụng trong thời gian combo còn hiệu lực',
    'Vui lòng chọn giờ còn trống trước khi xác nhận lịch hẹn',
  ];
  return {
    id: combo.id,
    branchId: combo.branchId,
    serviceIds: combo.comboServices.map((item) => item.service.id),
    title: combo.name,
    shopName: branchName,
    discountPercent: Math.round(numberValue(combo.discountPercentage)),
    price,
    originalPrice,
    logoText: logoText(branchName),
    duration: `${combo.durationMinutes} phút`,
    address,
    hours: '',
    rating: branch && 'rating' in branch ? numberValue(branch.rating) : 0,
    steps: combo.description ? [combo.description, ...steps] : steps,
    terms,
    imageUrls: combo.images?.map((item) => item.media.url).filter(Boolean) ?? [],
  };
}

export function mapReview(review: ApiReview): Review {
  return {
    id: review.id,
    reviewerName: review.customerName,
    date: new Date(review.appointmentDate || review.createdAt).toLocaleDateString('vi-VN'),
    score: numberValue(review.overallRating),
    text: review.comment || 'Khách hàng không để lại bình luận.',
  };
}

export interface SearchVenue extends RemoteVenue {
  reviewCount: number;
  servicesFromSearch: RemoteServiceItem[];
}

export function groupSearchRows(rows: ApiSearchService[]): SearchVenue[] {
  const grouped = new Map<string, SearchVenue>();
  rows.forEach((row) => {
    const venue = grouped.get(row.branchId) ?? {
      id: row.branchId,
      businessId: row.businessId,
      branchName: row.branchName,
      name: row.businessName || row.branchName,
      address: row.address || [row.districtName, row.provinceName].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ',
      rating: numberValue(row.rating),
      tag: 'Booking' as const,
      distanceKm: 0,
      hasHourlyPromo: false,
      logoText: logoText(row.businessName || row.branchName),
      reviewCount: numberValue(row.reviewCount),
      servicesFromSearch: [],
    };
    venue.servicesFromSearch.push({
      id: row.id,
      branchId: row.branchId,
      name: row.displayName,
      duration: `${row.durationMinutes} phút`,
      price: numberValue(row.price),
      originalPrice: numberValue(row.price),
    });
    venue.reviewCount = Math.max(venue.reviewCount, numberValue(row.reviewCount));
    venue.rating = Math.max(venue.rating, numberValue(row.rating));
    grouped.set(row.branchId, venue);
  });
  return [...grouped.values()];
}
