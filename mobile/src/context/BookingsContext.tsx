import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { getApiAccessToken, getApiSessionGeneration, refreshAccessToken, subscribeApiAccessToken } from '../api/client';
import { bindBookingSocket, createInvalidationQueue, schedulerOrigin } from '../utils/bookingSync';
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
  serverNow?: string;
  branchTimezone?: string;
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
    durationMinutes?: number;
    status?: string;
    itemStartAt?: string | null;
    itemEndAt?: string | null;
    actualStartedAt?: string | null;
    actualCompletedAt?: string | null;
    actualStoppedAt?: string | null;
    actualTimingSource?: 'SERVICE_ADJUSTMENT' | 'ACTUAL_TIME_CORRECTION' | 'UNAVAILABLE';
  }>;
}

interface BookingsContextValue {
  bookings: ConfirmedBooking[];
  isLoading: boolean;
  isRefreshing: boolean;
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
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(getApiSessionGeneration);
  const { user, isRestoring } = useAuth();
  const userId = user?.id ?? null;
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;
  const queueRef = useRef<ReturnType<typeof createInvalidationQueue<ConfirmedBooking[]>> | null>(null);
  const loadedRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const visibleBookings = dataOwnerId === userId && getApiAccessToken() ? bookings : [];

  const reload = useCallback(async () => { await queueRef.current?.invalidate(); }, []);

  useEffect(() => {
    let active = true;
    const generation = getApiSessionGeneration();
    const ownsSession = () => active && currentUserIdRef.current === userId &&
      generation === getApiSessionGeneration() && Boolean(getApiAccessToken());
    const clear = () => {
      loadedRef.current = false;
      ownerRef.current = null;
      setBookings([]);
      setDataOwnerId(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
    };
    clear();
    if (!userId || isRestoring || !getApiAccessToken()) return () => { active = false; };
    const queue = createInvalidationQueue({
      fetch: async () => (await bookingsApi.mine()).map(mapBooking),
      commit: rows => {
        if (!ownsSession()) return;
        loadedRef.current = true;
        ownerRef.current = userId;
        // Tabs can overlap while a booking transitions between API requests.
        setBookings([...new Map(rows.map(row => [row.id, row])).values()]);
        setDataOwnerId(userId);
        setError(null);
      },
      fail: reason => {
        if (ownsSession()) setError(reason instanceof Error ? reason.message : 'Không tải được lịch hẹn');
      },
      busy: busy => {
        if (!ownsSession()) return;
        setLoading(busy && !loadedRef.current);
        setRefreshing(busy && loadedRef.current);
      },
    });
    queueRef.current = queue;
    const socket = io(schedulerOrigin(API_BASE_URL), {
      autoConnect: false,
      forceNew: true,
      auth: { token: getApiAccessToken() },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });
    const sync = bindBookingSocket(socket, {
      token: getApiAccessToken,
      subscribeToken: listener => subscribeApiAccessToken(token => {
        if (generation !== getApiSessionGeneration()) {
          // Logout/session replacement clears and fences immediately, before React rerenders.
          queue.dispose();
          clear();
          sync.dispose();
          setSessionEpoch(getApiSessionGeneration());
          return;
        }
        listener(token);
      }),
      refreshToken: refreshAccessToken,
      invalidate: () => { void queue.invalidate(); },
      clear: () => { clear(); void queue.invalidate(); },
      suspend: value => queue.suspend(value),
      active: AppState.currentState === 'active' || AppState.currentState == null,
    });
    const appState = AppState.addEventListener('change', state => sync.setActive(state === 'active'));
    void queue.invalidate();
    return () => {
      active = false;
      appState.remove();
      sync.dispose();
      queue.dispose();
      if (queueRef.current === queue) queueRef.current = null;
    };
  }, [userId, isRestoring, sessionEpoch]);

  const addBooking = async (input: CreateBookingInput, idempotencyKey: string): Promise<ConfirmedBooking> => {
    if (!userId) throw new Error('Vui lòng đăng nhập để đặt lịch.');
    const generation = getApiSessionGeneration();
    const created = mapBooking(await bookingsApi.create(input, idempotencyKey));
    if (currentUserIdRef.current !== userId || generation !== getApiSessionGeneration()) {
      throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại lịch hẹn.');
    }
    loadedRef.current = true;
    setLoading(false);
    setDataOwnerId(userId);
    setBookings(current => [created, ...(ownerRef.current === userId ? current.filter(item => item.id !== created.id) : [])]);
    ownerRef.current = userId;
    // Fence a list request begun before create committed; reconcile via the API.
    void reload();
    return created;
  };

  const getBooking = (id: string) => visibleBookings.find(booking => booking.id === id);
  const cancelBooking = async (id: string, reason?: string) => {
    await bookingsApi.cancel(id, reason);
    await reload();
  };
  const requestCancellation = async (id: string, reason?: string) => {
    await bookingsApi.requestCancellation(id, reason);
    await reload();
  };

  return (
    <BookingsContext.Provider value={{ bookings: visibleBookings, isLoading, isRefreshing, error, reload, addBooking, getBooking, cancelBooking, requestCancellation }}>
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
