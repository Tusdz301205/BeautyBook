/** Owner projections intentionally omit contact, finance, review and health data. */
export interface OwnerScope {
  isCurrent?: () => boolean;
  userId: string;
  workspace?: string;
  sessionType?: string;
  businessId: string | null;
  roles: string[];
  scopes: Array<{ code: string; businessId: string | null; branchId: string | null; expiresAt?: string | null }>;
  branches: Array<{ id: string; name: string; businessId: string; timezone?: string; status?: string }>;
  branchId: string | null;
}
export interface OwnerBooking {
  id: string;
  code: string;
  businessId: string;
  branchId: string;
  branchName: string;
  timezone: string;
  customerName: string;
  status: string;
  date: string;
  start: string | null;
  end: string | null;
  note: string | null;
  items: Array<{ id: string; name: string; staffId: string | null; staffName: string | null; status: string; revision: number | null }>;
  checkinAllowed: boolean;
}
export interface OwnerRequest {
  id: string;
  booking: OwnerBooking;
  type: string;
  status: string;
  reason: string | null;
  expiresAt: string | null;
  proposedStart: string | null;
  proposedEnd: string | null;
  proposedStaff: string | null;
  proposedStaffId: string | null;
  lateCancellation: boolean;
  invalidated: boolean;
}
export interface OwnerImpact {
  id: string;
  businessId: string;
  branchId: string | null;
  reason: string;
  status: string;
  deadlineAt: string | null;
  subjectType: string;
  action: string;
  items?: Array<{ id: string; bookingId: string; status: string; resolution: string | null; reason: string | null; booking: OwnerBooking | null }>;
}
export interface OwnerDashboard {
  date: string;
  branches: Array<{ id: string; name: string; bookings: number; completedBookings: number; activeProfiles: number }>;
  statuses: Array<{ status: string; count: number }>;
  bookings: number;
  completedBookings: number;
}
