import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { bookingsApi, type CreateBookingInput } from '../api/bookings';
import { mapBooking } from '../mappers/booking';
import { useAuth } from './AuthContext';

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled';

export interface ConfirmedBooking {
  id: string;
  bookingCode?: string;
  branchId: string;
  serviceIds: string[];
  variantSelections: Record<string, string>;
  shopName: string;
  address: string;
  serviceName: string;
  staffName: string;
  date: string;
  time: string;
  appointmentStartAt: string;
  totalPrice: number;
  status: BookingStatus;
  rawStatus?: string;
  reviewed: boolean;
  hasPendingCancellationRequest: boolean;
  cancellationRequestExpiresAt?: string;
  bookingServices: Array<{
    id: string;
    serviceId?: string;
    staffId?: string;
    serviceName: string;
    staffName?: string;
  }>;
}

interface BookingsContextValue {
  bookings: ConfirmedBooking[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addBooking: (booking: CreateBookingInput, idempotencyKey: string) => Promise<ConfirmedBooking>;
  getBooking: (id: string) => ConfirmedBooking | undefined;
  cancelBooking: (id: string, reason?: string) => Promise<void>;
  requestCancellation: (id: string, reason?: string) => Promise<void>;
}

const BookingsContext = createContext<BookingsContextValue | undefined>(undefined);

export function BookingsProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<ConfirmedBooking[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const { user, isRestoring } = useAuth();
  const userId = user?.id ?? null;
  const currentUserIdRef = useRef(userId);
  const requestRef = useRef(0);
  currentUserIdRef.current = userId;
  const visibleBookings = dataOwnerId === userId ? bookings : [];

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!userId || isRestoring) {
      setBookings([]);
      setDataOwnerId(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await bookingsApi.mine();
      if (currentUserIdRef.current !== userId || requestRef.current !== requestId) return;
      setBookings(rows.map(mapBooking));
      setDataOwnerId(userId);
    } catch (reason) {
      if (currentUserIdRef.current === userId && requestRef.current === requestId) {
        setError(reason instanceof Error ? reason.message : 'Không tải được lịch hẹn');
      }
    } finally {
      if (currentUserIdRef.current === userId && requestRef.current === requestId) setLoading(false);
    }
  }, [userId, isRestoring]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addBooking = async (input: CreateBookingInput, idempotencyKey: string): Promise<ConfirmedBooking> => {
    if (!userId) throw new Error('Vui lòng đăng nhập để đặt lịch.');
    const created = mapBooking(await bookingsApi.create(input, idempotencyKey));
    if (currentUserIdRef.current !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại lịch hẹn.');
    requestRef.current += 1;
    setLoading(false);
    setDataOwnerId(userId);
    setBookings((current) => [created, ...(dataOwnerId === userId ? current.filter((item) => item.id !== created.id) : [])]);
    return created;
  };

  const getBooking = (id: string) => visibleBookings.find((booking) => booking.id === id);

  const cancelBooking = async (id: string, reason?: string) => {
    await bookingsApi.cancel(id, reason);
    await reload();
  };

  const requestCancellation = async (id: string, reason?: string) => {
    await bookingsApi.requestCancellation(id, reason);
    await reload();
  };

  return (
    <BookingsContext.Provider value={{ bookings: visibleBookings, isLoading, error, reload, addBooking, getBooking, cancelBooking, requestCancellation }}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error('useBookings must be used within a BookingsProvider');
  }
  return context;
}
