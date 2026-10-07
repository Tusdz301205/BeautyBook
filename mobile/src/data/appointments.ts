import { colors } from '../constants/colors';
import { BookingStatus, ConfirmedBooking } from '../context/BookingsContext';

export type AppointmentStatus = BookingStatus;

export interface Appointment {
  id: string;
  isReal: boolean;
  comboId?: string;
  comboTitle: string;
  shopName: string;
  address: string;
  staffName: string;
  price: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  rawStatus?: string;
  imageUri: string;
}

export const STATUS_META: Record<AppointmentStatus, { label: string; color: string; background: string }> = {
  upcoming: { label: 'Sắp tới', color: colors.reviewTag, background: '#E3F3FC' },
  completed: { label: 'Hoàn thành', color: colors.ratingGreen, background: '#E7F7E9' },
  cancelled: { label: 'Đã hủy', color: colors.discountRed, background: '#FBE2E6' },
};

export function bookingStatusMeta(status: AppointmentStatus, rawStatus?: string) {
  switch (rawStatus) {
    case 'PENDING':
      return { label: 'Chờ cơ sở xác nhận', color: colors.reviewTag, background: '#E3F3FC' };
    case 'CONFIRMED':
      return { label: 'Đã xác nhận', color: colors.reviewTag, background: '#E3F3FC' };
    case 'CHECKED_IN':
      return { label: 'Đã đến cơ sở', color: colors.ratingGreen, background: '#E7F7E9' };
    case 'IN_PROGRESS':
      return { label: 'Đang thực hiện', color: colors.primary, background: colors.primaryLight };
    case 'EXPIRED':
      return { label: 'Hết hạn xác nhận', color: colors.textGray, background: colors.background };
    case 'REJECTED':
      return { label: 'Cơ sở từ chối', color: colors.discountRed, background: '#FBE2E6' };
    case 'NO_SHOW':
      return { label: 'Không đến', color: colors.discountRed, background: '#FBE2E6' };
    default:
      return STATUS_META[status];
  }
}

const WEEKDAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function mapBookingsToAppointments(bookings: ConfirmedBooking[]): Appointment[] {
  return bookings.map((booking) => ({
    id: booking.id,
    isReal: true,
    comboTitle: booking.serviceName,
    shopName: booking.shopName,
    address: booking.address,
    staffName: booking.staffName,
    price: booking.totalPrice,
    date: booking.date,
    time: booking.time,
    status: booking.status,
    rawStatus: booking.rawStatus,
    imageUri: '',
  }));
}

export function parseApptDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split(/[/-]/).map(Number);
  return new Date(year, month - 1, day);
}

export function parseApptMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    const minute = parseInt(ampm[2], 10);
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + (minute || 0);
}

export function apptTimestamp(item: Appointment): number {
  return parseApptDate(item.date).getTime() + parseApptMinutes(item.time) * 60_000;
}

export function isPastUpcoming(item: Appointment, now = Date.now()): boolean {
  if (item.rawStatus === 'CHECKED_IN' || item.rawStatus === 'IN_PROGRESS') return false;
  return item.status === 'upcoming' && apptTimestamp(item) < now;
}

export function getCountdownLabel(item: Appointment): string {
  const target = parseApptDate(item.date);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Ngày mai';
  if (diffDays > 1) return `Còn ${diffDays} ngày`;
  return 'Đã qua giờ hẹn';
}

export function formatGroupHeader(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (diffDays === 0) return `Hôm nay, ${dayStr}`;
  if (diffDays === 1) return `Ngày mai, ${dayStr}`;
  if (diffDays === -1) return `Hôm qua, ${dayStr}`;
  return `${WEEKDAY_FULL[d.getDay()]}, ${dayStr}${d.getFullYear() === today.getFullYear() ? '' : `/${d.getFullYear()}`}`;
}

export interface DateGroup {
  key: string;
  date: Date;
  items: Appointment[];
}

export function groupByDate(items: Appointment[]): DateGroup[] {
  const groups: DateGroup[] = [];
  items.forEach((item) => {
    const date = parseApptDate(item.date);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, date, items: [item] });
    }
  });
  return groups;
}
