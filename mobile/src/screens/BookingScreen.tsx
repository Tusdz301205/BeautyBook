import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';

import { BookingServiceLine, HomeStackParamList } from '../navigation/HomeStack';
import { colors, elevation, layout, radius, space, tones, type, fw } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import SelectListSheet from '../components/SelectListSheet';
import { useBookings } from '../context/BookingsContext';
import { bookingsApi, type CreateBookingInput, type SelfBookingPolicy } from '../api/bookings';
import { ApiError, createIdempotencyKey, getApiSessionGeneration, subscribeApiAccessToken } from '../api/client';
import { recurringApi, type CreateRecurringInput, type RecurringFrequency, type RecurringPreview, type RecurringStaffMode } from '../api/recurring';
import BookingRecurrence from '../components/BookingRecurrence';
import { recurringInput, recurringPreviewReady, validOccurrenceCount } from '../utils/bookingRecurrence';
import { servicesApi } from '../api/services';
import { staffApi } from '../api/staff';
import type { ApiAvailableSlot, ApiPricePreview, ApiService, ApiStaff } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { slotClock, slotDate, slotHour } from '../utils/bookingClock';

const ANY_STAFF = 'Bất kỳ';

function isSlotConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409
    && /khung giờ này (vừa|đang)|không còn (nhân viên phù hợp|khả dụng) trong khung giờ|nhân viên này không còn khả dụng trong khung giờ|nhân viên đã có lịch trùng|vui lòng chọn lại giờ/i.test(error.message);
}

type Props = NativeStackScreenProps<HomeStackParamList, 'Booking'>;

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEK_COUNT = 5;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function StepTitle({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <View style={styles.stepHead}>
      <Text style={styles.stepIndex}>{index}</Text>
      <View style={styles.flex}>
        <Text accessibilityRole="header" style={styles.stepTitle}>{title}</Text>
        {hint ? <Text style={styles.helperText}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export default function BookingScreen({ route, navigation }: Props) {
  const { branchId, shopName, addresses, service, serviceIds, comboId, staffOptions: routeStaff = [] } = route.params;
  const { addBooking, reload, rememberBookings } = useBookings();
  const { isLoggedIn, user } = useAuth();
  const currentUserIdRef = useRef(user?.id);
  currentUserIdRef.current = user?.id;
  const [sessionEpoch, setSessionEpoch] = useState(getApiSessionGeneration);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeApiAccessToken(() => setSessionEpoch(getApiSessionGeneration()));
    return () => { mountedRef.current = false; unsubscribe(); };
  }, []);
  const [addedServices, setAddedServices] = useState<BookingServiceLine[]>([]);
  const [publicStaff, setPublicStaff] = useState<ApiStaff[]>(
    routeStaff.map((staff) => ({ id: staff.id, fullName: staff.name })),
  );
  const [isLoadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const staffChoices = useMemo(() => {
    const labels = publicStaff.map((person) => `${person.fullName} · ${person.professionalTitle || person.position || 'Chuyên viên'}`);
    const seen = new Map<string, number>();
    return publicStaff.map((person, index) => {
      const base = labels[index];
      const occurrence = (seen.get(base) || 0) + 1;
      seen.set(base, occurrence);
      return { id: person.id, label: labels.filter((value) => value === base).length > 1 ? `${base} (${occurrence})` : base };
    });
  }, [publicStaff]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(route.params.initialStaffId ?? null);
  const selectedStaffLabel = staffChoices.find((choice) => choice.id === selectedStaffId)?.label || ANY_STAFF;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const allDays = useMemo(() => {
    const start = mondayOf(today);
    return Array.from({ length: WEEK_COUNT * 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [today]);

  const todayIndex = allDays.findIndex((date) => dateKey(date) === dateKey(today));

  const [selectedAddress, setSelectedAddress] = useState(addresses[0]);
  const [isAddressPickerVisible, setAddressPickerVisible] = useState(false);
  const [weekIndex, setWeekIndex] = useState(Math.floor(todayIndex / 7));
  const [selectedDateIndex, setSelectedDateIndex] = useState(todayIndex);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<ApiAvailableSlot[]>([]);
  const [isLoadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
  const [isSubmitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [isReviewVisible, setReviewVisible] = useState(false);
  const checkoutAttemptRef = useRef<({ kind: 'single'; input: CreateBookingInput } | { kind: 'recurring'; input: CreateRecurringInput }) & { key: string; userId: string } | null>(null);
  const [isOutcomeUnknown, setOutcomeUnknown] = useState(false);
  const [selectedApiServices, setSelectedApiServices] = useState<ApiService[]>([]);
  const [isLoadingServiceInfo, setLoadingServiceInfo] = useState(true);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [pricePreview, setPricePreview] = useState<ApiPricePreview | null>(null);
  const [isLoadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const serviceQuantity = 1;
  const [note, setNote] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [policy, setPolicy] = useState<SelfBookingPolicy | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [occurrenceCount, setOccurrenceCount] = useState('4');
  const [staffMode, setStaffMode] = useState<RecurringStaffMode>('ANY_AVAILABLE');
  const [skipConflicts, setSkipConflicts] = useState(false);
  const [recurringResult, setRecurringResult] = useState<{ key: object; preview: RecurringPreview } | null>(null);
  const [recurringFailure, setRecurringFailure] = useState<{ key: object; message: string } | null>(null);
  const [recurringRefreshKey, setRecurringRefreshKey] = useState(0);

  const weekDays = allDays.slice(weekIndex * 7, weekIndex * 7 + 7);
  const selectedDate = allDays[selectedDateIndex];
  const selectedServiceIds = [...new Set([...serviceIds, ...addedServices.map((item) => item.id)])];
  const selectedServiceKey = selectedServiceIds.join(',');
  const variantsComplete = Boolean(comboId) || (selectedApiServices.every((item) =>
    !item.variants?.length || Boolean(variantSelections[item.id]),
  ) && selectedApiServices.length === selectedServiceIds.length);
  const recurrenceUnsupported = Object.keys(variantSelections).length > 0
    || (!comboId && selectedApiServices.some((item) => Boolean(item.variants?.length)));
  const count = validOccurrenceCount(occurrenceCount);
  const recurringPayload = selectedTime && count !== null ? recurringInput({
    branchId, serviceIds: selectedServiceIds, comboId, slot: selectedTime,
    staffId: selectedStaffId || undefined, staffMode, frequency, occurrenceCount: count,
  }) : null;
  const recurringSignature = recurringEnabled && isLoggedIn && !recurrenceUnsupported && !isLoadingServiceInfo && recurringPayload
    ? JSON.stringify([user?.id, sessionEpoch, recurringPayload, recurringRefreshKey]) : null;
  // Identity also changes when returning to an earlier selection: never reuse its old availability.
  const recurringKey = useMemo(() => recurringSignature ? { signature: recurringSignature } : null, [recurringSignature]);
  const recurringPreview = recurringKey && recurringResult?.key === recurringKey ? recurringResult.preview : null;
  const recurringError = recurringKey && recurringFailure?.key === recurringKey ? recurringFailure.message : null;
  const previewingRecurring = Boolean(recurringKey && !recurringPreview && !recurringError);
  const recurringReady = !recurringEnabled || Boolean(recurringKey && recurringPreviewReady(recurringPreview, skipConflicts));

  useEffect(() => {
    if (!selectedStaffId) setStaffMode('ANY_AVAILABLE');
  }, [selectedStaffId]);

  useEffect(() => {
    if (!recurringKey || !recurringPayload) return;
    let active = true;
    const generation = getApiSessionGeneration();
    recurringApi.preview(recurringPayload).then((preview) => {
      if (active && generation === getApiSessionGeneration()) setRecurringResult({ key: recurringKey, preview });
    }).catch((reason) => {
      if (active && generation === getApiSessionGeneration()) setRecurringFailure({ key: recurringKey, message: reason instanceof Error ? reason.message : 'Không kiểm tra được chuỗi lịch.' });
    });
    return () => { active = false; };
  }, [recurringKey]);

  useEffect(() => {
    if (!isLoggedIn) { setPolicy(null); return; }
    let active = true;
    const generation = getApiSessionGeneration();
    setPolicy(null);
    setPolicyError(null);
    setAcknowledged(false);
    bookingsApi.selfBookingPolicy(branchId).then((result) => {
      if (active && generation === getApiSessionGeneration()) setPolicy(result);
    }).catch((reason) => {
      if (active && generation === getApiSessionGeneration()) setPolicyError(reason instanceof Error ? reason.message : 'Không kiểm tra được chính sách đặt lịch');
    });
    return () => { active = false; };
  }, [branchId, isLoggedIn, user?.id, sessionEpoch]);

  useEffect(() => {
    setVariantSelections((current) => Object.fromEntries(
      Object.entries(current).filter(([serviceId]) => selectedServiceIds.includes(serviceId)),
    ));
  }, [selectedServiceKey]);

  useEffect(() => {
    let active = true;
    setLoadingServiceInfo(true);
    servicesApi.list(branchId)
      .then((rows) => {
        if (!active) return;
        setSelectedApiServices(rows.filter((item) => selectedServiceIds.includes(item.id)));
      })
      .catch(() => {
        if (active) setSelectedApiServices([]);
      })
      .finally(() => {
        if (active) setLoadingServiceInfo(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, selectedServiceKey]);

  useEffect(() => {
    let active = true;
    setLoadingStaff(true);
    setStaffError(null);
    staffApi.publicByServices(branchId, selectedServiceIds)
      .then((rows) => {
        if (!active) return;
        setPublicStaff(rows);
        setSelectedStaffId((current) => rows.some((item) => item.id === current) ? current : null);
      })
      .catch((reason) => {
        if (!active) return;
        setStaffError(reason instanceof Error ? reason.message : 'Không tải được chuyên viên');
      })
      .finally(() => {
        if (active) setLoadingStaff(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, selectedServiceKey]);

  useEffect(() => {
    let active = true;
    setSelectedTime(null);
    if (!selectedServiceIds.length || isLoadingServiceInfo || !variantsComplete) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return () => {
        active = false;
      };
    }
    setLoadingSlots(true);
    setSlotsError(null);
    const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    bookingsApi.availableSlots({
      branchId,
      serviceIds: selectedServiceIds,
      date,
      staffId: selectedStaffId || undefined,
      variantSelections,
    })
      .then((response) => {
        if (active) setAvailableSlots(response.slots);
      })
      .catch((reason) => {
        if (!active) return;
        setAvailableSlots([]);
        setSlotsError(reason instanceof Error ? reason.message : 'Không tải được giờ trống');
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, selectedDate, selectedStaffId, selectedServiceKey, variantsComplete, isLoadingServiceInfo, slotsRefreshKey, JSON.stringify(variantSelections)]);

  useEffect(() => {
    let active = true;
    if (!isLoggedIn || !selectedTime || !variantsComplete) {
      setPricePreview(null);
      setPriceError(null);
      return () => {
        active = false;
      };
    }
    setLoadingPrice(true);
    const generation = getApiSessionGeneration();
    setPriceError(null);
    const timer = setTimeout(() => {
      bookingsApi.previewPrice({
        branchId,
        serviceIds: selectedServiceIds,
        comboId,
        appointmentDate: selectedTime,
        variantSelections,
        voucherCode: recurringEnabled ? undefined : voucherCode.trim() || undefined,
      })
        .then((result) => {
          if (active && generation === getApiSessionGeneration()) setPricePreview(result);
        })
        .catch((reason) => {
          if (!active || generation !== getApiSessionGeneration()) return;
          setPricePreview(null);
          setPriceError(reason instanceof Error ? reason.message : 'Chưa tính được giá. Vui lòng thử lại.');
        })
        .finally(() => {
          if (active) setLoadingPrice(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isLoggedIn, user?.id, sessionEpoch, selectedTime, variantsComplete, branchId, selectedServiceKey, comboId, voucherCode, recurringEnabled, JSON.stringify(variantSelections)]);

  // Slots are instants from the backend booking zone; group and label them in that zone.
  const slotGroups = [
    { label: 'Sáng', slots: availableSlots.filter((slot) => slotHour(slot.start) < 12) },
    { label: 'Chiều', slots: availableSlots.filter((slot) => slotHour(slot.start) >= 12 && slotHour(slot.start) < 17) },
    { label: 'Tối', slots: availableSlots.filter((slot) => slotHour(slot.start) >= 17) },
  ].filter((group) => group.slots.length > 0);

  const extraTotal = addedServices.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const localTotalPrice = service.price * serviceQuantity + extraTotal;
  const totalPrice = Number(pricePreview?.finalAmount ?? localTotalPrice);
  const totalSavings = (service.originalPrice - service.price) * serviceQuantity;
  const canContinue = Boolean(
    selectedTime
    && variantsComplete
    && !isLoadingServiceInfo
    && !isSubmitting
    && !isOutcomeUnknown
    && (!isLoggedIn || recurringReady)
    && (!isLoggedIn || (pricePreview && !isLoadingPrice && policy?.selfBookingAllowed
      && (!policy.acknowledgmentRequired || acknowledged))),
  );

  usePreventRemove(isSubmitting || isOutcomeUnknown, () => {
    Alert.alert('Đang kiểm tra đặt lịch', 'Hãy kiểm tra Lịch hẹn hoặc thử lại yêu cầu đã gửi trước khi rời màn hình này.');
  });

  useEffect(() => {
    if (!isReviewVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSubmitting) return true;
      setReviewVisible(false);
      return true;
    });
    return () => subscription.remove();
  }, [isReviewVisible, isSubmitting]);

  const submitBooking = async () => {
    if (submitLockRef.current || !user) return;
    const previousAttempt = checkoutAttemptRef.current;
    if (previousAttempt && previousAttempt.userId !== user.id) {
      Alert.alert('Tài khoản đã thay đổi', 'Vui lòng đăng nhập lại tài khoản đã gửi yêu cầu và kiểm tra Lịch hẹn.');
      return;
    }
    if (!previousAttempt && !canContinue) return;
    const generation = getApiSessionGeneration();
    const ownsSession = () => mountedRef.current && currentUserIdRef.current === user.id && generation === getApiSessionGeneration();
    submitLockRef.current = true;
    setSubmitting(true);
    let submitted = false;
    let bookingId: string | undefined;
    let createdSeries = false;
    try {
      if (!previousAttempt) {
        if (!selectedTime || !pricePreview) return;
        const freshPrice = await bookingsApi.previewPrice({
          branchId,
          serviceIds: selectedServiceIds,
          comboId,
          appointmentDate: selectedTime,
          variantSelections,
          voucherCode: recurringEnabled ? undefined : voucherCode.trim() || undefined,
        });
        if (!ownsSession()) return;
        if (Number(freshPrice.finalAmount) !== Number(pricePreview.finalAmount)) {
          setPricePreview(freshPrice);
          setReviewVisible(false);
          Alert.alert('Giá đã thay đổi', 'Giá mới đã được cập nhật. Vui lòng xem lại trước khi xác nhận.');
          return;
        }
        const checkoutInput = {
          branchId,
          serviceIds: comboId ? undefined : selectedServiceIds,
          comboId,
          variantSelections,
          appointmentDate: selectedTime,
          staffId: selectedStaffId || undefined,
          note: note.trim() || undefined,
          voucherCode: voucherCode.trim() || undefined,
          violationAcknowledged: acknowledged,
        };
        // Snapshot the body as well as the key: an uncertain retry must replay the same request.
        const attemptBody = recurringEnabled && recurringPayload
          ? { kind: 'recurring' as const, input: JSON.parse(JSON.stringify({ ...recurringPayload, skipConflicts, note: note.trim() || undefined, violationAcknowledged: acknowledged })) as CreateRecurringInput }
          : { kind: 'single' as const, input: JSON.parse(JSON.stringify(checkoutInput)) as CreateBookingInput };
        checkoutAttemptRef.current = {
          ...attemptBody,
          key: createIdempotencyKey('mobile-booking'),
          userId: user.id,
        };
      }
      const attempt = checkoutAttemptRef.current!;
      if (!ownsSession() || attempt.userId !== currentUserIdRef.current) {
        throw new ApiError('Tài khoản đã thay đổi. Vui lòng kiểm tra Lịch hẹn.', 401);
      }
      submitted = true;
      if (attempt.kind === 'recurring') {
        const plan = await recurringApi.create(attempt.input, attempt.key);
        if (!ownsSession()) {
          if (mountedRef.current) setOutcomeUnknown(true);
          return;
        }
        createdSeries = true;
        bookingId = plan.bookings?.[0]?.id;
        // Creation is settled before refreshing the list. Refresh failure must never replay it.
        checkoutAttemptRef.current = null;
        setOutcomeUnknown(false);
        setReviewVisible(false);
        rememberBookings(plan.bookings ?? [], generation);
        void reload().catch(() => {});
        const created = plan.bookings?.length ?? plan.createdOccurrenceCount ?? 0;
        Alert.alert('Đã tạo chuỗi lịch', `Đã tạo ${created} lịch hẹn · bỏ qua ${Math.max(0, attempt.input.occurrenceCount - created)} kỳ.`);
      } else {
        const booking = await addBooking(attempt.input, attempt.key);
        if (!ownsSession()) {
          if (mountedRef.current) setOutcomeUnknown(true);
          return;
        }
        bookingId = booking.id;
      }
      checkoutAttemptRef.current = null;
      setOutcomeUnknown(false);
      setReviewVisible(false);
    } catch (reason) {
      if (!ownsSession()) {
        // A request may have reached the server before a session replacement.
        if (submitted && mountedRef.current) { setOutcomeUnknown(true); setReviewVisible(false); }
        return;
      }
      const failureCode = reason instanceof ApiError ? (reason.payload as { code?: string } | undefined)?.code : undefined;
      const settledRecurringFailure = checkoutAttemptRef.current?.kind === 'recurring' && failureCode
        && ['RECURRING_CREATE_ROLLED_BACK', 'RECURRING_PREVIEW_CONFLICT', 'RECURRING_NO_AVAILABILITY'].includes(failureCode);
      if (settledRecurringFailure) {
        checkoutAttemptRef.current = null;
        setOutcomeUnknown(false);
        setReviewVisible(false);
        setRecurringRefreshKey(value => value + 1);
        Alert.alert('Không thể tạo chuỗi lịch', failureCode === 'RECURRING_CREATE_ROLLED_BACK'
          ? `${(reason as ApiError).message}\nCác kỳ đã tạo đã được hoàn tác. Bạn có thể điều chỉnh rồi thử lại.`
          : (reason as ApiError).message);
      } else if (previousAttempt || (submitted && (!(reason instanceof ApiError) || reason.status === 0 || reason.status >= 500 || reason.status === 408
        || (reason.status === 409 && (/idempotency|request trùng đang được xử lý/i.test(reason.message)
          || (checkoutAttemptRef.current?.kind === 'recurring' && !/Một số kỳ bị trùng lịch|Không có kỳ nào còn chỗ/i.test(reason.message))))))) {
        setOutcomeUnknown(true);
        setReviewVisible(false);
      } else if (checkoutAttemptRef.current?.kind === 'recurring' && reason instanceof ApiError && reason.status === 409) {
        checkoutAttemptRef.current = null;
        setOutcomeUnknown(false);
        setReviewVisible(false);
        setRecurringRefreshKey((value) => value + 1);
        Alert.alert('Chuỗi lịch cần kiểm tra lại', reason.message);
      } else if (isSlotConflict(reason)) {
        checkoutAttemptRef.current = null;
        setOutcomeUnknown(false);
        setReviewVisible(false);
        setSelectedTime(null);
        setSlotsRefreshKey((current) => current + 1);
        Alert.alert('Khung giờ không còn trống', 'Khung giờ vừa có người đặt. Danh sách giờ trống đã được cập nhật, vui lòng chọn lại.');
      } else {
        checkoutAttemptRef.current = null;
        setOutcomeUnknown(false);
        Alert.alert('Không thể đặt lịch', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
      }
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
    if (ownsSession()) {
      if (bookingId) navigation.navigate('BookingSuccess', { bookingId });
      else if (createdSeries) navigation.getParent()?.navigate('LichHen');
    }
  };

  const locked = isSubmitting || isOutcomeUnknown;
  const priceIsServerQuote = Boolean(pricePreview);
  const blockedReason = !isLoggedIn ? (selectedTime ? 'Đăng nhập để xem giá chính xác và gửi yêu cầu.' : 'Chọn giờ trước, rồi đăng nhập để xem giá chính xác và gửi yêu cầu.')
    : isLoadingServiceInfo ? 'Đang kiểm tra dịch vụ…'
      : !variantsComplete ? 'Chọn lựa chọn cho từng dịch vụ để xem giờ trống.'
        : !selectedTime ? 'Chọn giờ để tiếp tục.'
          : recurringEnabled && recurrenceUnsupported ? 'Lựa chọn dịch vụ này chưa hỗ trợ lịch lặp. Hãy tắt lịch lặp.'
            : recurringEnabled && count === null ? 'Nhập số kỳ từ 2 đến 52.'
              : recurringEnabled && !recurringReady ? (previewingRecurring ? 'Đang kiểm tra chuỗi lịch…' : recurringError || 'Kiểm tra chuỗi lịch và chọn bỏ qua xung đột, hoặc đổi ngày/giờ.')
          : policy && !policy.selfBookingAllowed ? 'Tài khoản đang bị hạn chế tự đặt lịch tại cơ sở này.'
            : policy?.acknowledgmentRequired && !acknowledged ? 'Xác nhận cảnh báo chính sách để tiếp tục.'
              : isLoadingPrice ? 'Đang tính giá…'
                : !pricePreview ? 'Chưa tính được giá. Kiểm tra kết nối hoặc chọn lại giờ.'
                  : null;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại" style={styles.backButton} disabled={locked} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={locked ? colors.disabledText : colors.heading} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text accessibilityRole="header" style={styles.headerTitle}>Đặt lịch</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{shopName}</Text>
        </View>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView pointerEvents={locked ? 'none' : 'auto'} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <StepTitle index={1} title="Dịch vụ" hint={comboId ? 'Gói dịch vụ áp dụng nguyên gói.' : undefined} />
          <View style={[styles.card, styles.summaryCard]}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.helperText}>{service.duration}</Text>
            <View style={styles.servicePriceRow}>
              <Text style={styles.servicePrice}>{formatCurrency(service.price)}</Text>
              {service.originalPrice > service.price ? <Text style={styles.serviceOriginalPrice}>{formatCurrency(service.originalPrice)}</Text> : null}
            </View>
            {addedServices.map((item) => (
              <View key={item.id} style={styles.extraServiceRow}>
                <Ionicons name="add-circle-outline" size={18} color={colors.secondaryText} />
                <View style={styles.flex}>
                  <Text style={styles.extraServiceName}>{item.name}</Text>
                  <Text style={styles.helperText}>{item.duration}</Text>
                </View>
                <Text style={styles.extraServicePrice}>{formatCurrency(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={16} color={colors.secondaryText} />
              <Text style={styles.addressText}>{selectedAddress}</Text>
              {addresses.length > 1 ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đổi chi nhánh" style={styles.linkButton} onPress={() => setAddressPickerVisible(true)}>
                  <Text style={styles.linkText}>Đổi</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {!comboId && selectedApiServices.map((item) => {
            const variants = (item.variants ?? []).filter((variant) => variant.priceType !== 'QUOTE' && !variant.consultationRequired);
            if (!item.variants?.length) return null;
            return (
              <View key={`variants-${item.id}`} style={styles.card}>
                <Text style={styles.variantTitle}>Lựa chọn cho {item.name}</Text>
                {variants.length ? variants.map((variant) => {
                  const selected = variantSelections[item.id] === variant.id;
                  return (
                    <TouchableOpacity
                      key={variant.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => setVariantSelections((current) => ({ ...current, [item.id]: variant.id }))}
                    >
                      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.borderStrong} />
                      <View style={styles.flex}>
                        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{variant.name}</Text>
                        <Text style={styles.helperText}>{variant.priceDisplay || formatCurrency(Number(variant.price ?? item.price))} · {variant.durationMinutes ?? item.durationMinutes} phút</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }) : <Text style={styles.errorText}>Dịch vụ này cần tư vấn và chưa thể đặt trực tuyến.</Text>}
              </View>
            );
          })}
          {!isLoadingServiceInfo && selectedApiServices.length !== selectedServiceIds.length && (
            <Text style={styles.errorText}>Có dịch vụ không còn khả dụng. Vui lòng quay lại chi nhánh và chọn lại dịch vụ.</Text>
          )}
          {!comboId && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.outlineButton}
              onPress={() => navigation.navigate('AddService', {
                branchId,
                shopName,
                selected: Object.fromEntries(addedServices.map((item) => [item.id, item.quantity])),
                onConfirm: setAddedServices,
              })}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={styles.outlineButtonText}>{addedServices.length ? 'Sửa dịch vụ thêm' : 'Thêm dịch vụ'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <StepTitle index={2} title="Chuyên viên" hint="Chọn trước khi xem giờ trống; đổi chuyên viên sẽ cập nhật lại giờ." />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {[{ id: null as string | null, label: ANY_STAFF }, ...staffChoices].map((choice) => {
              const selected = selectedStaffId === choice.id;
              return (
                <TouchableOpacity
                  key={choice.id ?? 'any'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: isLoadingStaff }}
                  disabled={isLoadingStaff}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => { setSelectedStaffId(choice.id); setSelectedTime(null); }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{choice.id ? choice.label : 'Bất kỳ chuyên viên'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {isLoadingStaff && <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />}
          {!!staffError && <Text style={styles.helperText}>{staffError}. Bạn vẫn có thể để cơ sở tự phân công.</Text>}
        </View>

        <View style={styles.section}>
          <StepTitle index={3} title="Ngày" />
          <View style={styles.card}>
            <View style={styles.monthNavRow}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tuần trước" accessibilityState={{ disabled: weekIndex === 0 }} style={styles.navButton} disabled={weekIndex === 0} onPress={() => setWeekIndex((prev) => Math.max(0, prev - 1))}>
                <Ionicons name="chevron-back" size={22} color={weekIndex === 0 ? colors.disabledText : colors.heading} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                Tháng {weekDays[0].getMonth() + 1}/{weekDays[0].getFullYear()}
                {(weekDays[0].getMonth() !== weekDays[weekDays.length - 1].getMonth() || weekDays[0].getFullYear() !== weekDays[weekDays.length - 1].getFullYear()) && ` – ${weekDays[weekDays.length - 1].getMonth() + 1}/${weekDays[weekDays.length - 1].getFullYear()}`}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tuần sau" accessibilityState={{ disabled: weekIndex === WEEK_COUNT - 1 }} style={styles.navButton} disabled={weekIndex === WEEK_COUNT - 1} onPress={() => setWeekIndex((prev) => Math.min(WEEK_COUNT - 1, prev + 1))}>
                <Ionicons name="chevron-forward" size={22} color={weekIndex === WEEK_COUNT - 1 ? colors.disabledText : colors.heading} />
              </TouchableOpacity>
            </View>
            <View style={styles.daysRow}>
              {weekDays.map((date, index) => {
                const dateIndex = weekIndex * 7 + index;
                const isSelected = dateIndex === selectedDateIndex;
                const isDisabled = date.getTime() < today.getTime();
                return (
                  <TouchableOpacity
                    key={dateKey(date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${WEEKDAY_LABELS[index]}, ngày ${date.getDate()}/${date.getMonth() + 1}${dateIndex === todayIndex ? ', hôm nay' : ''}`}
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                    style={[styles.dayCell, isDisabled && styles.dayCellDisabled, isSelected && styles.dayCellSelected]}
                    disabled={isDisabled}
                    onPress={() => { setSelectedDateIndex(dateIndex); setSelectedTime(null); }}
                  >
                    <Text style={[styles.dayWeekday, isDisabled && styles.dayTextDisabled, isSelected && styles.dayTextSelected]}>{WEEKDAY_LABELS[index]}</Text>
                    <Text style={[styles.dayNumber, isDisabled && styles.dayTextDisabled, isSelected && styles.dayTextSelected]}>{date.getDate()}</Text>
                    {dateIndex === todayIndex ? <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <StepTitle index={4} title="Giờ" hint="Giờ theo múi giờ Việt Nam (GMT+7)." />
          <View style={styles.card}>
            {slotGroups.map((group) => (
              <View key={group.label} style={styles.slotGroup}>
                <Text style={styles.timeGroupLabel}>{group.label}</Text>
                <View style={styles.slotGrid}>
                  {group.slots.map((slot) => {
                    const isSelected = selectedTime === slot.start;
                    return (
                      <TouchableOpacity
                        key={slot.start}
                        accessibilityRole="radio"
                        accessibilityLabel={`${slotClock(slot.start)}, còn trống`}
                        accessibilityState={{ checked: isSelected }}
                        style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                        onPress={() => setSelectedTime(slot.start)}
                      >
                        <Text style={[styles.timeSlotTime, isSelected && styles.timeSlotTextSelected]}>{slotClock(slot.start)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            {isLoadingSlots && <ActivityIndicator color={colors.primary} style={styles.slotLoader} />}
            {!!slotsError && (
              <View style={styles.inlineNotice}>
                <Text style={styles.errorText}>{slotsError}</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.linkButton} onPress={() => setSlotsRefreshKey((current) => current + 1)}><Text style={styles.linkText}>Tải lại giờ trống</Text></TouchableOpacity>
              </View>
            )}
            {!isLoadingSlots && !slotsError && availableSlots.length === 0 && (
              <Text style={styles.helperText}>{variantsComplete ? 'Không còn giờ trống trong ngày đã chọn. Thử ngày khác hoặc chuyên viên khác.' : 'Chọn lựa chọn dịch vụ ở bước 1 để xem giờ trống.'}</Text>
            )}
          </View>
        </View>

        {isLoggedIn && <BookingRecurrence
          enabled={recurringEnabled} onEnabled={setRecurringEnabled}
          frequency={frequency} onFrequency={setFrequency}
          count={occurrenceCount} onCount={setOccurrenceCount}
          staffMode={staffMode} onStaffMode={setStaffMode} hasStaff={Boolean(selectedStaffId)}
          skipConflicts={skipConflicts} onSkipConflicts={setSkipConflicts}
          preview={recurringPreview} loading={previewingRecurring} error={recurringError}
          onRetry={() => setRecurringRefreshKey((value) => value + 1)} unsupported={recurrenceUnsupported}
        />}

        <View style={styles.section}>
          <StepTitle index={5} title="Ưu đãi và ghi chú" />
          <Text style={styles.fieldLabel}>Mã voucher <Text style={styles.helperText}>· không bắt buộc</Text></Text>
          <TextInput
            accessibilityLabel="Mã voucher, không bắt buộc"
            style={styles.input}
            value={voucherCode}
            onChangeText={setVoucherCode}
            editable={!locked && !recurringEnabled}
            autoCapitalize="characters"
            placeholder="Nhập mã nếu có"
            placeholderTextColor={colors.disabledText}
          />
          {recurringEnabled && <Text style={styles.helperText}>Voucher không áp dụng cho chuỗi lịch.</Text>}
          {isLoadingPrice && <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />}
          {!!priceError && <Text style={styles.errorText}>{priceError}</Text>}
          {!!pricePreview?.promotionDiscount && <Text style={styles.discountText}>Khuyến mãi tự động: -{formatCurrency(pricePreview.promotionDiscount)}</Text>}
          {!!pricePreview?.voucherDiscount && <Text style={styles.discountText}>Voucher: -{formatCurrency(pricePreview.voucherDiscount)}</Text>}
          <Text style={[styles.fieldLabel, styles.fieldSpacing]}>Ghi chú cho cơ sở <Text style={styles.helperText}>· không bắt buộc</Text></Text>
          <TextInput
            accessibilityLabel="Ghi chú cho cơ sở, không bắt buộc"
            style={[styles.input, styles.noteInput]}
            placeholder="Ví dụ: da nhạy cảm, xin nhẹ tay"
            placeholderTextColor={colors.disabledText}
            multiline
            editable={!locked}
            value={note}
            onChangeText={setNote}
          />
          {!!policyError && <Text style={styles.errorText}>{policyError}</Text>}
          {policy && !policy.selfBookingAllowed && (
            <Text style={styles.errorText}>Tài khoản đang bị hạn chế tự đặt lịch tại {policy.businessName}. Vui lòng liên hệ cơ sở.</Text>
          )}
          {policy?.acknowledgmentRequired && (
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: acknowledged }} onPress={() => setAcknowledged((value) => !value)} style={styles.ackRow}>
              <Ionicons name={acknowledged ? 'checkbox' : 'square-outline'} size={24} color={acknowledged ? colors.primary : colors.borderStrong} />
              <Text style={styles.ackText}>Tôi hiểu cảnh báo {policy.score} điểm vi phạm và vẫn muốn đặt lịch.</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        {isOutcomeUnknown && <View accessibilityLiveRegion="polite" style={styles.unknownBox}>
          <View style={styles.unknownHead}>
            <Ionicons name="warning-outline" size={20} color={tones.warning.fg} />
            <Text style={styles.unknownTitle}>Chưa rõ kết quả đặt lịch</Text>
          </View>
          <Text style={styles.unknownText}>Yêu cầu có thể đã được tạo. Hãy kiểm tra Lịch hẹn. Thử lại sẽ kiểm tra cùng yêu cầu đã gửi, không tạo yêu cầu mới.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.outlineButton} onPress={() => navigation.getParent()?.navigate('LichHen')}>
            <Text style={styles.outlineButtonText}>Xem lịch hẹn của tôi</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Thử lại yêu cầu đặt lịch đã gửi" style={[styles.nextButton, isSubmitting && styles.nextButtonDisabled]} disabled={isSubmitting} onPress={() => void submitBooking()}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.nextButtonText}>Thử lại yêu cầu đã gửi</Text>}
          </TouchableOpacity>
        </View>}
        <View style={styles.totalRow}>
          <View style={styles.flex}>
            <Text style={styles.totalLabel}>{recurringEnabled ? 'Dự kiến kỳ đầu tiên' : priceIsServerQuote ? 'Tổng dự kiến' : 'Tạm tính'}</Text>
            {totalSavings > 0 && <Text style={styles.savingsText}>Tiết kiệm {formatCurrency(totalSavings)}</Text>}
          </View>
          <Text style={styles.totalValue}>{formatCurrency(totalPrice)}</Text>
        </View>
        {!isOutcomeUnknown && !!blockedReason && <Text style={styles.blockedText}>{blockedReason}</Text>}
        {!isOutcomeUnknown && <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isLoggedIn ? 'Xem lại đặt lịch' : 'Đăng nhập để tiếp tục đặt lịch'}
          accessibilityState={{ disabled: !canContinue }}
          style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]}
          disabled={!canContinue}
          onPress={() => {
            if (!selectedTime) return;
            if (!isLoggedIn) {
              if (navigationRef.isReady()) {
                navigationRef.navigate('Login', { returnTo: 'previous' });
              }
              return;
            }
            setReviewVisible(true);
          }}
        >
          <Text style={[styles.nextButtonText, !canContinue && styles.nextButtonTextDisabled]}>{isLoggedIn ? 'Xem lại đặt lịch' : 'Đăng nhập để tiếp tục'}</Text>
        </TouchableOpacity>}
      </SafeAreaView>

      {isReviewVisible && <View style={styles.reviewBackdrop} accessibilityViewIsModal>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng xem lại đặt lịch" style={styles.reviewDismissArea} disabled={isSubmitting} onPress={() => setReviewVisible(false)} />
        <SafeAreaView edges={['bottom']} style={styles.reviewSheet}>
          <View style={styles.reviewHandle} />
          <View style={styles.reviewHeading}>
            <View style={styles.flex}><Text style={styles.reviewEyebrow}>Bước cuối</Text><Text accessibilityRole="header" style={styles.reviewTitle}>Xem lại đặt lịch</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng xem lại đặt lịch" disabled={isSubmitting} onPress={() => setReviewVisible(false)} style={styles.backButton}><Ionicons name="close" size={24} color={colors.heading} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent}>
            <Text style={styles.reviewLabel}>Cơ sở</Text><Text style={styles.reviewValue}>{shopName}</Text><Text style={styles.reviewSubvalue}>{selectedAddress}</Text>
            <View style={styles.reviewDivider} />
            <Text style={styles.reviewLabel}>Dịch vụ</Text><Text style={styles.reviewValue}>{selectedApiServices.map((item) => item.name).join(', ') || service.name}</Text>
            <View style={styles.reviewDivider} />
            <Text style={styles.reviewLabel}>Thời gian</Text><Text style={styles.reviewValue}>{selectedTime ? `${slotDate(selectedTime)} · ${slotClock(selectedTime)}` : ''}</Text>
            <Text style={styles.reviewSubvalue}>Chuyên viên: {recurringEnabled && staffMode === 'ANY_AVAILABLE' ? 'Bất kỳ người phù hợp cho từng kỳ' : selectedStaffLabel}</Text>
            {recurringEnabled && <>
              <View style={styles.reviewDivider} />
              <Text style={styles.reviewLabel}>Chuỗi lịch · {frequency === 'WEEKLY' ? 'Mỗi tuần' : frequency === 'BIWEEKLY' ? 'Mỗi 2 tuần' : 'Mỗi tháng'}</Text>
              <Text style={styles.reviewValue}>{occurrenceCount} kỳ · {recurringPreview?.availableCount ?? 0} còn chỗ · {recurringPreview?.conflictCount ?? 0} xung đột{skipConflicts ? ' sẽ bỏ qua' : ''}</Text>
              <Text style={styles.reviewSubvalue}>{staffMode === 'SAME_STAFF' ? `Giữ cùng chuyên viên: ${selectedStaffLabel}` : 'Bất kỳ chuyên viên phù hợp cho từng kỳ'}</Text>
            </>}
            <View style={styles.reviewDivider} />
            <Text style={styles.reviewLabel}>{recurringEnabled ? 'Giá dự kiến kỳ đầu tiên' : 'Giá dự kiến'}</Text><Text style={styles.reviewPrice}>{formatCurrency(pricePreview?.finalAmount ?? totalPrice)}</Text>
            {recurringEnabled && <Text style={styles.reviewNote}>Giá từng kỳ được xác định khi tạo chuỗi lịch. Voucher không áp dụng.</Text>}
            <Text style={styles.reviewNote}>Cơ sở có thể cần xác nhận trước khi lịch có hiệu lực. Giá được kiểm tra lại khi bạn gửi.</Text>
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={recurringEnabled ? 'Xác nhận chuỗi lịch' : 'Xác nhận gửi đặt lịch'} style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]} disabled={!canContinue} onPress={() => void submitBooking()}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.nextButtonText}>{recurringEnabled ? 'Xác nhận chuỗi lịch' : 'Xác nhận đặt lịch'}</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </View>}

      <SelectListSheet
        visible={isAddressPickerVisible}
        title="Chọn chi nhánh"
        options={addresses}
        selectedValue={selectedAddress}
        onSelect={(address) => {
          setSelectedAddress(address);
          setAddressPickerVisible(false);
        }}
        onClose={() => setAddressPickerVisible(false)}
        columns={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, paddingBottom: space.xs, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backButton: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  headerTitle: { ...type.h3, ...fw.display, fontSize: 19 },
  headerSubtitle: { ...type.caption },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.xxxl },
  section: { marginBottom: space.xxl },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.md },
  stepIndex: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', ...type.caption, lineHeight: 28, fontSize: 13, ...fw.bold, color: colors.onPrimary, backgroundColor: colors.primary, overflow: 'hidden' },
  stepTitle: { ...type.h3, lineHeight: 28 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginBottom: space.md },
  summaryCard: { borderLeftWidth: 4, borderLeftColor: colors.primary, backgroundColor: colors.primaryTint },
  serviceName: { ...type.bodyStrong },
  servicePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  servicePrice: { ...type.price, color: colors.primary },
  serviceOriginalPrice: { ...type.secondary, textDecorationLine: 'line-through' },
  extraServiceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  extraServiceName: { ...type.secondaryStrong, color: colors.heading },
  extraServicePrice: { ...type.price, fontSize: 14 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  addressText: { ...type.secondary, flex: 1 },
  linkButton: { minHeight: layout.touch, justifyContent: 'center', paddingHorizontal: space.sm },
  linkText: { ...type.secondaryStrong, color: colors.primary },
  variantTitle: { ...type.secondaryStrong, color: colors.heading },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { ...type.secondaryStrong, color: colors.heading },
  optionTitleSelected: { color: colors.primary },
  outlineButton: { minHeight: layout.touch, flexDirection: 'row', gap: space.sm, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, backgroundColor: colors.surface },
  outlineButtonText: { ...type.button, color: colors.primary },
  chipRow: { gap: space.sm, paddingVertical: space.xs },
  chip: { minHeight: layout.touch - 4, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: space.lg },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.secondaryStrong, color: colors.heading },
  chipTextSelected: { color: colors.onPrimary },
  inlineLoader: { alignSelf: 'flex-start', marginTop: space.sm },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { ...type.secondaryStrong, color: colors.heading, flex: 1, textAlign: 'center' },
  daysRow: { flexDirection: 'row', gap: space.xs + 1 },
  dayCell: { flex: 1, minHeight: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.surfaceMuted },
  dayCellDisabled: { backgroundColor: 'transparent' },
  dayCellSelected: { backgroundColor: colors.primary },
  dayWeekday: { ...type.caption, ...fw.semibold },
  dayNumber: { ...type.clock, fontSize: 17 },
  dayTextSelected: { color: colors.onPrimary },
  dayTextDisabled: { color: colors.disabledText },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  todayDotSelected: { backgroundColor: colors.onPrimary },
  slotGroup: { marginBottom: space.sm },
  timeGroupLabel: { ...type.overline, marginBottom: space.sm },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  timeSlot: { minWidth: 76, minHeight: layout.touch, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, backgroundColor: colors.surface },
  timeSlotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeSlotTime: { ...type.clock },
  timeSlotTextSelected: { color: colors.onPrimary },
  slotLoader: { marginVertical: space.lg },
  inlineNotice: { gap: space.xs },
  fieldLabel: { ...type.secondaryStrong, color: colors.heading, marginBottom: space.xs + 2 },
  fieldSpacing: { marginTop: space.lg },
  input: { minHeight: layout.inputMinHeight, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: space.lg, ...type.body, color: colors.heading, backgroundColor: colors.surface },
  noteInput: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  helperText: { ...type.secondary },
  errorText: { ...type.secondary, color: colors.error, marginTop: space.sm },
  discountText: { ...type.secondaryStrong, color: colors.success, marginTop: space.sm },
  ackRow: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  ackText: { ...type.secondary, color: colors.heading, flex: 1 },
  bottomBar: { paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, gap: space.sm, ...elevation.raised },
  unknownBox: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: tones.warning.bg, borderWidth: 1, borderColor: tones.warning.border },
  unknownHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  unknownTitle: { ...type.secondaryStrong, color: tones.warning.fg },
  unknownText: { ...type.secondary, color: colors.body },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  totalLabel: { ...type.secondaryStrong, color: colors.heading },
  totalValue: { ...type.numeric, fontSize: 22, lineHeight: 28, color: colors.primary },
  savingsText: { ...type.caption, color: colors.success },
  blockedText: { ...type.caption },
  nextButton: { minHeight: layout.buttonMinHeight, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, marginBottom: space.sm },
  nextButtonDisabled: { backgroundColor: colors.disabledSurface },
  nextButtonText: { ...type.button, color: colors.onPrimary },
  nextButtonTextDisabled: { color: colors.disabledText },
  reviewBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20, shadowColor: 'transparent', backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  reviewDismissArea: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  reviewSheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: layout.gutter + space.xs, paddingTop: space.sm, maxHeight: '88%' },
  reviewHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.sm },
  reviewHeading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reviewEyebrow: { ...type.overline, color: colors.primary },
  reviewTitle: { ...type.h2, marginTop: 2 },
  reviewScroll: { flexGrow: 0, marginTop: space.lg, marginBottom: space.lg },
  reviewContent: { paddingBottom: space.xs },
  reviewLabel: { ...type.caption, marginBottom: space.xs },
  reviewValue: { ...type.bodyStrong },
  reviewSubvalue: { ...type.secondary, marginTop: 2 },
  reviewDivider: { height: 1, backgroundColor: colors.divider, marginVertical: space.md },
  reviewPrice: { ...type.numeric, color: colors.primary },
  reviewNote: { ...type.secondary, marginTop: space.md },
});
