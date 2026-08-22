import { Prisma } from '@prisma/client';

type BookableStaffWhereOptions = {
  branchId?: string;
  publicOnly?: boolean;
  requireSchedule?: boolean;
  serviceIds?: string[];
};

/**
 * Single database-level definition of a staff profile that may receive a
 * booking. Authorization roles are intentionally absent: an operational role
 * never implies service-provider capability.
 */
export function bookableStaffWhere({
  branchId,
  publicOnly = false,
  requireSchedule = false,
  serviceIds = [],
}: BookableStaffWhereOptions = {}): Prisma.StaffProfileWhereInput {
  return {
    ...(branchId ? { branchId } : {}),
    status: 'ACTIVE',
    deletedAt: null,
    isBookable: true,
    ...(publicOnly ? { publicVisible: true } : {}),
    ...(requireSchedule ? { workingHours: { some: { isOff: false } } } : {}),
    ...(serviceIds.length
      ? { staffServices: { some: { serviceId: { in: [...new Set(serviceIds)] } } } }
      : {}),
    OR: [
      { userId: null },
      { user: { is: { isActive: true, deletedAt: null } } },
    ],
  };
}

const INTERNAL_POSITION = /\b(branch manager|receptionist|business owner|platform admin|admin|manager|owner|quan ly|le tan|chu doanh nghiep|chu co so|quan tri)\b/i;

function normalizePosition(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function professionalTitle(position?: string | null): string {
  const value = position?.trim();
  if (!value || INTERNAL_POSITION.test(normalizePosition(value))) {
    return 'Chuyên viên làm đẹp';
  }
  return value;
}

export function staffRating(ratings: Array<{ rating: number }> = []) {
  if (!ratings.length) return { rating: null, ratingCount: 0 };
  const average = ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length;
  return { rating: Math.round(average * 10) / 10, ratingCount: ratings.length };
}
