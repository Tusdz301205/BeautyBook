import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BookingServiceLine, HomeStackParamList } from '../navigation/HomeStack';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import SelectListSheet from '../components/SelectListSheet';
import { useBookings } from '../context/BookingsContext';
import { bookingsApi, type SelfBookingPolicy } from '../api/bookings';
import { ApiError, createIdempotencyKey } from '../api/client';
import { servicesApi } from '../api/services';
import { staffApi } from '../api/staff';
import type { ApiAvailableSlot, ApiPricePreview, ApiService, ApiStaff } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';

const ANY_STAFF = 'Bất kỳ';

function isSlotConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409
    && /khung giờ này (vừa|đang)|không còn (nhân viên phù hợp|khả dụng) trong khung giờ|nhân viên này không còn khả dụng trong khung giờ|nhân viên đã có lịch trùng|vui lòng chọn lại giờ/i.test(error.message);
}

type Props = NativeStackScreenProps<HomeStackParamList, 'Booking'>;

const WEEKDAY_LABELS = ['Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Cn'];
const WEEK_COUNT = 5;
function formatSlotTime(value: string): string {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

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

function formatDisplayDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

function Stepper({
  value,
  onDecrement,
  onIncrement,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepperButton} activeOpacity={0.7} onPress={onDecrement}>
        <Ionicons name="remove" size={16} color={colors.textBody} />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepperButton, styles.stepperButtonPrimary]}
        activeOpacity={0.7}
        onPress={onIncrement}
      >
        <Ionicons name="add" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

export default function BookingScreen({ route, navigation }: Props) {
  const { branchId, shopName, addresses, service, serviceIds, comboId, staffOptions: routeStaff = [] } = route.params;
  const { addBooking } = useBookings();
  const { isLoggedIn } = useAuth();
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
  const staffOptions = useMemo(() => [ANY_STAFF, ...staffChoices.map((choice) => choice.label)], [staffChoices]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const selectedStaffLabel = staffChoices.find((choice) => choice.id === selectedStaffId)?.label || ANY_STAFF;
  const [isStaffPickerVisible, setStaffPickerVisible] = useState(false);

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
  const checkoutAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
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

  const weekDays = allDays.slice(weekIndex * 7, weekIndex * 7 + 7);
  const selectedDate = allDays[selectedDateIndex];
  const selectedServiceIds = [...new Set([...serviceIds, ...addedServices.map((item) => item.id)])];
  const selectedServiceKey = selectedServiceIds.join(',');
  const variantsComplete = Boolean(comboId) || (selectedApiServices.every((item) =>
    !item.variants?.length || Boolean(variantSelections[item.id]),
  ) && selectedApiServices.length === selectedServiceIds.length);

  useEffect(() => {
    if (!isLoggedIn) { setPolicy(null); return; }
    let active = true;
    setPolicy(null);
    setPolicyError(null);
    setAcknowledged(false);
    bookingsApi.selfBookingPolicy(branchId).then((result) => {
      if (active) setPolicy(result);
    }).catch((reason) => {
      if (active) setPolicyError(reason instanceof Error ? reason.message : 'Không kiểm tra được chính sách đặt lịch');
    });
    return () => { active = false; };
  }, [branchId, isLoggedIn]);

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
    setPriceError(null);
    const timer = setTimeout(() => {
      bookingsApi.previewPrice({
        branchId,
        serviceIds: selectedServiceIds,
        comboId,
        appointmentDate: selectedTime,
        variantSelections,
        voucherCode: voucherCode.trim() || undefined,
      })
        .then((result) => {
          if (active) setPricePreview(result);
        })
        .catch((reason) => {
          if (!active) return;
          setPricePreview(null);
          setPriceError(reason instanceof Error ? reason.message : 'Không tính được giá từ hệ thống');
        })
        .finally(() => {
          if (active) setLoadingPrice(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isLoggedIn, selectedTime, variantsComplete, branchId, selectedServiceKey, comboId, voucherCode, JSON.stringify(variantSelections)]);

  const morningSlots = availableSlots.filter((slot) => new Date(slot.start).getHours() < 12);
  const afternoonSlots = availableSlots.filter((slot) => new Date(slot.start).getHours() >= 12);

  const extraTotal = addedServices.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const localTotalPrice = service.price * serviceQuantity + extraTotal;
  const totalPrice = Number(pricePreview?.finalAmount ?? localTotalPrice);
  const totalSavings = (service.originalPrice - service.price) * serviceQuantity;
  const canContinue = Boolean(
    selectedTime
    && variantsComplete
    && !isLoadingServiceInfo
    && !isSubmitting
    && (!isLoggedIn || (pricePreview && !isLoadingPrice && policy?.selfBookingAllowed
      && (!policy.acknowledgmentRequired || acknowledged))),
  );

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
    if (!selectedTime || !pricePreview || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const freshPrice = await bookingsApi.previewPrice({
        branchId,
        serviceIds: selectedServiceIds,
        comboId,
        appointmentDate: selectedTime,
        variantSelections,
        voucherCode: voucherCode.trim() || undefined,
      });
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
      const fingerprint = JSON.stringify(checkoutInput);
      if (checkoutAttemptRef.current?.fingerprint !== fingerprint) {
        checkoutAttemptRef.current = { fingerprint, key: createIdempotencyKey('mobile-booking') };
      }
      const booking = await addBooking(checkoutInput, checkoutAttemptRef.current.key);
      checkoutAttemptRef.current = null;
      setReviewVisible(false);
      navigation.navigate('BookingSuccess', { bookingId: booking.id });
    } catch (reason) {
      if (isSlotConflict(reason)) {
        checkoutAttemptRef.current = null;
        setReviewVisible(false);
        setSelectedTime(null);
        setSlotsRefreshKey((current) => current + 1);
        Alert.alert('Khung giờ không còn trống', 'Khung giờ vừa có người đặt. Danh sách giờ trống đã được cập nhật, vui lòng chọn lại.');
      } else if (reason instanceof ApiError && reason.status === 0 && checkoutAttemptRef.current) {
        setReviewVisible(false);
        Alert.alert('Chưa rõ kết quả đặt lịch', 'Kết nối bị gián đoạn sau khi gửi. Hãy kiểm tra mục Lịch hẹn trước khi thử lại.');
      } else {
        Alert.alert('Không thể đặt lịch', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
      }
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt lịch</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Chọn chi nhánh</Text>
        <TouchableOpacity
          style={styles.branchPill}
          activeOpacity={0.7}
          onPress={() => setAddressPickerVisible(true)}
        >
          <Text style={styles.branchText}>
            {selectedAddress}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textGray} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>Chọn ngày</Text>
        <View style={styles.card}>
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              hitSlop={10}
              disabled={weekIndex === 0}
              onPress={() => setWeekIndex((prev) => Math.max(0, prev - 1))}
            >
              <Ionicons name="chevron-back" size={20} color={weekIndex === 0 ? colors.textMuted : colors.textDark} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              THÁNG {weekDays[0].getMonth() + 1}/{weekDays[0].getFullYear()}
              {(weekDays[0].getMonth() !== weekDays[weekDays.length - 1].getMonth() ||
                weekDays[0].getFullYear() !== weekDays[weekDays.length - 1].getFullYear()) &&
                ` – ${weekDays[weekDays.length - 1].getMonth() + 1}/${weekDays[weekDays.length - 1].getFullYear()}`}
            </Text>
            <TouchableOpacity
              hitSlop={10}
              disabled={weekIndex === WEEK_COUNT - 1}
              onPress={() => setWeekIndex((prev) => Math.min(WEEK_COUNT - 1, prev + 1))}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={weekIndex === WEEK_COUNT - 1 ? colors.textMuted : colors.textDark}
              />
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
                  style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                  activeOpacity={0.7}
                  disabled={isDisabled}
                  onPress={() => {
                    setSelectedDateIndex(dateIndex);
                    setSelectedTime(null);
                  }}
                >
                  <Text style={[styles.dayWeekday, isDisabled && styles.dayTextDisabled, isSelected && styles.dayTextSelected]}>
                    {WEEKDAY_LABELS[index]}
                  </Text>
                  <Text style={[styles.dayNumber, isDisabled && styles.dayTextDisabled, isSelected && styles.dayTextSelected]}>
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>Chọn giờ</Text>
        <View style={styles.card}>
          <Text style={styles.timeGroupLabel}>Sáng</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotRow}>
            {morningSlots.map((slot) => {
              const isSelected = selectedTime === slot.start;
              return (
                <TouchableOpacity
                  key={slot.start}
                  style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTime(slot.start)}
                >
                  <Text style={[styles.timeSlotTime, isSelected && styles.timeSlotTextSelected]}>
                    {formatSlotTime(slot.start)}
                  </Text>
                  <Text style={[styles.timeSlotSeats, isSelected && styles.timeSlotTextSelected]}>
                    Còn trống
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.timeGroupLabel, styles.timeGroupSpacing]}>Chiều</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotRow}>
            {afternoonSlots.map((slot) => {
              const isSelected = selectedTime === slot.start;
              return (
                <TouchableOpacity
                  key={slot.start}
                  style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTime(slot.start)}
                >
                  <Text style={[styles.timeSlotTime, isSelected && styles.timeSlotTextSelected]}>
                    {formatSlotTime(slot.start)}
                  </Text>
                  <Text style={[styles.timeSlotSeats, isSelected && styles.timeSlotTextSelected]}>
                    Còn trống
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {isLoadingSlots && <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />}
          {!!slotsError && <Text style={styles.savingsText}>{slotsError}</Text>}
          {!isLoadingSlots && !slotsError && availableSlots.length === 0 && (
            <Text style={styles.serviceDuration}>Không còn giờ trống trong ngày đã chọn.</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>Chọn chuyên viên</Text>
        <TouchableOpacity
          style={styles.branchPill}
          activeOpacity={0.7}
          disabled={isLoadingStaff}
          onPress={() => setStaffPickerVisible(true)}
        >
          <Text style={styles.branchText}>
            {selectedStaffLabel}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textGray} />
        </TouchableOpacity>
        {isLoadingStaff && <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />}
        {!!staffError && (
          <Text style={styles.helperText}>
            {staffError}. Bạn vẫn có thể để hệ thống tự phân công.
          </Text>
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>Chọn dịch vụ</Text>
        <View style={styles.serviceRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textGray} />
          <Text style={styles.serviceName}>{service.name}</Text>
        </View>
        <Text style={styles.serviceDuration}>{service.duration}</Text>
        <View style={styles.servicePriceRow}>
          <View style={styles.servicePriceTextWrap}>
            <Text style={styles.servicePrice}>{formatCurrency(service.price)}</Text>
            <Text style={styles.serviceOriginalPrice}>{formatCurrency(service.originalPrice)}</Text>
          </View>
          <Text style={styles.serviceDuration}>1 dịch vụ</Text>
        </View>

        {addedServices.map((item) => (
          <View key={item.id} style={styles.extraServiceRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textGray} />
            <View style={styles.extraServiceInfo}>
              <Text style={styles.extraServiceName}>
                {item.name} × {item.quantity}
              </Text>
              <Text style={styles.serviceDuration}>{item.duration}</Text>
            </View>
            <Text style={styles.extraServicePrice}>{formatCurrency(item.price * item.quantity)}</Text>
          </View>
        ))}

        {!comboId && selectedApiServices.map((item) => {
          const variants = (item.variants ?? []).filter(
            (variant) => variant.priceType !== 'QUOTE' && !variant.consultationRequired,
          );
          if (!item.variants?.length) return null;
          return (
            <View key={`variants-${item.id}`} style={styles.variantCard}>
              <Text style={styles.variantTitle}>Lựa chọn cho {item.name}</Text>
              {variants.length ? variants.map((variant) => {
                const selected = variantSelections[item.id] === variant.id;
                return (
                  <TouchableOpacity
                    key={variant.id}
                    style={[styles.variantOption, selected && styles.variantOptionSelected]}
                    onPress={() => setVariantSelections((current) => ({ ...current, [item.id]: variant.id }))}
                  >
                    <View style={styles.variantTextWrap}>
                      <Text style={[styles.variantName, selected && styles.variantNameSelected]}>{variant.name}</Text>
                      <Text style={styles.helperText}>
                        {variant.priceDisplay || formatCurrency(Number(variant.price ?? item.price))}
                        {' · '}{variant.durationMinutes ?? item.durationMinutes} phút
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              }) : (
                <Text style={styles.errorText}>Dịch vụ này cần tư vấn và chưa thể đặt trực tuyến.</Text>
              )}
            </View>
          );
        })}
        {!isLoadingServiceInfo && selectedApiServices.length !== selectedServiceIds.length && (
          <Text style={styles.errorText}>
            Có dịch vụ không còn khả dụng. Vui lòng quay lại chi nhánh và chọn lại dịch vụ.
          </Text>
        )}

        {!comboId && <TouchableOpacity
          style={styles.outlineButton}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('AddService', {
              branchId,
              shopName,
              selected: Object.fromEntries(addedServices.map((item) => [item.id, item.quantity])),
              onConfirm: setAddedServices,
            })
          }
        >
          <Text style={styles.outlineButtonText}>THÊM DỊCH VỤ</Text>
        </TouchableOpacity>}

        <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>Khuyến mãi</Text>
        <TextInput
          style={styles.voucherInput}
          value={voucherCode}
          onChangeText={setVoucherCode}
          autoCapitalize="characters"
          placeholder="Nhập mã voucher (không bắt buộc)"
          placeholderTextColor={colors.textMuted}
        />
        {isLoadingPrice && <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />}
        {!!priceError && <Text style={styles.errorText}>{priceError}</Text>}
        {!!policyError && <Text style={styles.errorText}>{policyError}</Text>}
        {policy && !policy.selfBookingAllowed && (
          <Text style={styles.errorText}>Tài khoản đang bị hạn chế tự đặt lịch tại {policy.businessName}. Vui lòng liên hệ cơ sở.</Text>
        )}
        {policy?.acknowledgmentRequired && (
          <TouchableOpacity onPress={() => setAcknowledged((value) => !value)} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>{acknowledged ? '☑' : '☐'} Tôi hiểu cảnh báo {policy.score} điểm vi phạm và vẫn muốn đặt lịch.</Text>
          </TouchableOpacity>
        )}
        {!!pricePreview?.promotionDiscount && (
          <Text style={styles.discountText}>Khuyến mãi tự động: -{formatCurrency(pricePreview.promotionDiscount)}</Text>
        )}
        {!!pricePreview?.voucherDiscount && (
          <Text style={styles.discountText}>Voucher: -{formatCurrency(pricePreview.voucherDiscount)}</Text>
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>Ghi chú</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Ví dụ: Da nhạy cảm, xin shop nhẹ tay"
          placeholderTextColor={colors.textMuted}
          multiline
          value={note}
          onChangeText={setNote}
        />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng tiền</Text>
          <View style={styles.totalValueWrap}>
            <Text style={styles.totalValue}>{formatCurrency(totalPrice)}</Text>
            {totalSavings > 0 && <Text style={styles.savingsText}>tiết kiệm: {formatCurrency(totalSavings)}</Text>}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]}
          activeOpacity={0.85}
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
          <Text style={styles.nextButtonText}>XEM LẠI ĐẶT LỊCH</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {isReviewVisible && <View style={styles.reviewBackdrop} accessibilityViewIsModal>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng xem lại đặt lịch" style={styles.reviewDismissArea} disabled={isSubmitting} onPress={() => setReviewVisible(false)} />
          <SafeAreaView edges={['bottom']} style={styles.reviewSheet}>
            <View style={styles.reviewHeading}>
              <View style={styles.reviewHeadingCopy}><Text style={styles.reviewEyebrow}>BƯỚC CUỐI CÙNG</Text><Text style={styles.reviewTitle}>Xem lại đặt lịch</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng xem lại đặt lịch" disabled={isSubmitting} onPress={() => setReviewVisible(false)} style={styles.reviewClose}><Ionicons name="close" size={22} color={colors.textDark} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent}>
              <Text style={styles.reviewLabel}>Cơ sở</Text><Text style={styles.reviewValue}>{shopName}</Text><Text style={styles.reviewSubvalue}>{selectedAddress}</Text>
              <View style={styles.reviewDivider} />
              <Text style={styles.reviewLabel}>Dịch vụ</Text><Text style={styles.reviewValue}>{selectedApiServices.map((item) => item.name).join(', ') || service.name}</Text>
              <View style={styles.reviewDivider} />
              <Text style={styles.reviewLabel}>Thời gian</Text><Text style={styles.reviewValue}>{selectedTime ? `${new Date(selectedTime).toLocaleDateString('vi-VN')} · ${formatSlotTime(selectedTime)}` : ''}</Text>
              <Text style={styles.reviewSubvalue}>Chuyên viên: {selectedStaffLabel}</Text>
              <View style={styles.reviewDivider} />
              <Text style={styles.reviewLabel}>Giá dự kiến</Text><Text style={styles.reviewPrice}>{formatCurrency(pricePreview?.finalAmount ?? totalPrice)}</Text>
              <Text style={styles.reviewNote}>Yêu cầu sẽ ở trạng thái chờ cơ sở xác nhận. Giá được kiểm tra lại khi bạn gửi.</Text>
            </ScrollView>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xác nhận gửi đặt lịch" style={[styles.nextButton, isSubmitting && styles.nextButtonDisabled]} disabled={isSubmitting} onPress={() => void submitBooking()}>
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.nextButtonText}>XÁC NHẬN ĐẶT LỊCH</Text>}
            </TouchableOpacity>
          </SafeAreaView>
        </View>}

      <SelectListSheet
        visible={isStaffPickerVisible}
        title="Chọn chuyên viên"
        options={staffOptions}
        selectedValue={selectedStaffLabel}
        onSelect={(label) => {
          setSelectedStaffId(label === ANY_STAFF ? null : staffChoices.find((choice) => choice.label === label)?.id || null);
          setSelectedTime(null);
          setStaffPickerVisible(false);
        }}
        onClose={() => setStaffPickerVisible(false)}
        columns={1}
      />

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
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 12,
  },
  sectionSpacingTop: {
    marginTop: 26,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  branchText: {
    flex: 1,
    fontSize: 15,
    color: colors.textDark,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  dayCellSelected: {
    backgroundColor: colors.primaryLight,
  },
  dayWeekday: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  dayTextSelected: {
    color: colors.primary,
  },
  dayTextDisabled: {
    color: colors.textMuted,
  },
  timeGroupLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textGray,
    marginBottom: 12,
  },
  timeGroupSpacing: {
    marginTop: 20,
  },
  timeSlotRow: {
    gap: 10,
    paddingRight: 4,
  },
  timeSlot: {
    minWidth: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
  },
  timeSlotSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  timeSlotTime: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  timeSlotSeats: {
    fontSize: 12,
    color: colors.textGray,
  },
  timeSlotTextSelected: {
    color: colors.primary,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPrimary: {
    backgroundColor: colors.primaryLight,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    minWidth: 18,
    textAlign: 'center',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  serviceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  serviceDuration: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 12,
  },
  servicePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  servicePriceTextWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  serviceOriginalPrice: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  extraServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  extraServiceInfo: {
    flex: 1,
    gap: 2,
  },
  extraServiceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  extraServicePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  helperText: {
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 12,
    color: colors.discountRed,
    lineHeight: 18,
    marginTop: 8,
  },
  variantCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  variantTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textDark,
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  variantOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  variantTextWrap: {
    flex: 1,
  },
  variantName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  variantNameSelected: {
    color: colors.primary,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  outlineButtonDisabled: {
    borderColor: colors.border,
  },
  outlineButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  outlineButtonTextDisabled: {
    color: colors.textMuted,
  },
  voucherInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.textDark,
  },
  discountText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ratingGreen,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    minHeight: 90,
    fontSize: 15,
    color: colors.textDark,
    textAlignVertical: 'top',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  totalValueWrap: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  savingsText: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: colors.border,
  },
  nextButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  reviewBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20, backgroundColor: '#22151CAA', justifyContent: 'flex-end' },
  reviewDismissArea: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  reviewSheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22, maxHeight: '88%' },
  reviewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewHeadingCopy: { flex: 1, minWidth: 0 },
  reviewEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  reviewTitle: { color: colors.textDark, fontSize: 25, lineHeight: 32, fontWeight: '700', marginTop: 3 },
  reviewClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reviewScroll: { flexGrow: 0, marginTop: 20, marginBottom: 18 },
  reviewContent: { paddingBottom: 4 },
  reviewLabel: { color: colors.textGray, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  reviewValue: { color: colors.textDark, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  reviewSubvalue: { color: colors.textBody, fontSize: 14, lineHeight: 20, marginTop: 3 },
  reviewDivider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  reviewPrice: { color: colors.primary, fontSize: 25, fontWeight: '700' },
  reviewNote: { color: colors.textGray, fontSize: 13, lineHeight: 19, marginTop: 12 },
});
