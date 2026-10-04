import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import { ResultType } from '../context/FilterContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 250;
const PRICE_MAX = 1200000;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type SortKey = 'best' | 'rating';
export interface AppliedSearchFilters { sort?: 'rating'; maxPrice?: number }

const SORT_OPTIONS: { key: SortKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'best', icon: 'heart', label: 'Kết quả phù hợp nhất' },
  { key: 'rating', icon: 'star-outline', label: 'Được xếp hạng cao nhất' },
];

interface ChipOption {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const AMENITIES: ChipOption[] = [
  { key: 'pet', icon: 'paw-outline', label: 'Thân thiện với thú cưng' },
  { key: 'adult', icon: 'people-outline', label: 'Chỉ dành cho người lớn' },
  { key: 'kid', icon: 'happy-outline', label: 'Thân thiện với trẻ em' },
  { key: 'wheelchair', icon: 'accessibility-outline', label: 'Lối đi cho xe lăn' },
  { key: 'menOnly', icon: 'man-outline', label: 'Chỉ dành cho nam giới' },
  { key: 'womenOnly', icon: 'woman-outline', label: 'Chỉ dành cho nữ giới' },
  { key: 'parking', icon: 'car-outline', label: 'Có chỗ đỗ xe' },
  { key: 'transit', icon: 'bus-outline', label: 'Gần phương tiện công cộng' },
  { key: 'shower', icon: 'water-outline', label: 'Nhà tắm vòi sen' },
  { key: 'locker', icon: 'lock-closed-outline', label: 'Tủ khóa' },
  { key: 'towel', icon: 'shirt-outline', label: 'Khăn tắm' },
  { key: 'pool', icon: 'water-outline', label: 'Hồ bơi' },
  { key: 'sauna', icon: 'thermometer-outline', label: 'Phòng xông hơi khô' },
];

const BOOKING_OPTIONS: ChipOption[] = [
  { key: 'promo', icon: 'pricetag-outline', label: 'Ưu đãi' },
  { key: 'group', icon: 'people-outline', label: 'Chấp nhận nhóm' },
];

const SERVICE_TYPES: { key: string; label: string }[] = [
  { key: 'all', label: 'Mọi người' },
  { key: 'women', label: 'Chỉ dành cho nữ' },
  { key: 'men', label: 'Chỉ dành cho nam' },
];

function PriceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const dragStartRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = trackWidthRef.current ? (valueRef.current / PRICE_MAX) * trackWidthRef.current : 0;
      },
      onPanResponderMove: (_, gesture) => {
        if (!trackWidthRef.current) return;
        const nextX = Math.min(trackWidthRef.current, Math.max(0, dragStartRef.current + gesture.dx));
        onChange(Math.round((nextX / trackWidthRef.current) * PRICE_MAX));
      },
    })
  ).current;

  const thumbX = trackWidth ? (value / PRICE_MAX) * trackWidth : 0;

  return (
    <View
      style={styles.sliderTrackWrap}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        setTrackWidth(e.nativeEvent.layout.width);
      }}
    >
      <View style={styles.sliderTrackBg} />
      <View style={[styles.sliderTrackFill, { width: thumbX }]} />
      <View style={[styles.sliderThumb, { left: Math.max(0, thumbX - 14) }]} {...panResponder.panHandlers}>
        <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
      </View>
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const isSelected = selected.has(option.key);
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.chip, isSelected && styles.chipSelected]}
            activeOpacity={0.7}
            onPress={() => onToggle(option.key)}
          >
            <Ionicons name={option.icon} size={16} color={isSelected ? colors.primary : colors.textBody} />
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface Props {
  visible: boolean;
  resultType: ResultType;
  onChangeResultType: (type: ResultType) => void;
  onClose: () => void;
  onApply: (filters: AppliedSearchFilters) => void;
}

export default function FilterSheet({ visible, resultType, onChangeResultType, onClose, onApply }: Props) {
  const [isRendered, setIsRendered] = useState(visible);
  const [sort, setSort] = useState<SortKey>('best');
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
  const [amenities, setAmenities] = useState<Set<string>>(new Set());
  const [bookingOptions, setBookingOptions] = useState<Set<string>>(new Set());
  const [serviceType, setServiceType] = useState('all');
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);
  const segmentTranslateX = useRef(new Animated.Value(0)).current;
  const slotWidth = (segmentWidth - 6) / 2;

  useEffect(() => {
    if (!slotWidth) return;
    Animated.spring(segmentTranslateX, {
      toValue: resultType === 'expert' ? slotWidth : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [resultType, slotWidth, segmentTranslateX]);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: ANIM_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setIsRendered(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!isRendered) return null;

  const toggleInSet = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const clearAll = () => {
    setSort('best');
    setMaxPrice(PRICE_MAX);
    setAmenities(new Set());
    setBookingOptions(new Set());
    setServiceType('all');
  };

  const priceLabel = maxPrice >= PRICE_MAX ? `${formatCurrency(PRICE_MAX)}+` : formatCurrency(maxPrice);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <AnimatedTouchable style={[styles.backdrop, { opacity: backdropOpacity }]} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Bộ lọc</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textDark} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.segmentGroup} onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}>
            {slotWidth > 0 && (
              <Animated.View
                style={[
                  styles.segmentIndicator,
                  { width: slotWidth, transform: [{ translateX: segmentTranslateX }] },
                ]}
              />
            )}
            <TouchableOpacity style={styles.segmentButton} activeOpacity={0.8} onPress={() => onChangeResultType('place')}>
              <Text style={[styles.segmentText, resultType === 'place' && styles.segmentTextActive]}>Địa điểm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.segmentButton} activeOpacity={0.8} onPress={() => onChangeResultType('expert')}>
              <Text style={[styles.segmentText, resultType === 'expert' && styles.segmentTextActive]}>chuyên gia</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Sắp xếp theo</Text>
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((option) => {
              const isSelected = option.key === sort;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.sortCard, isSelected && styles.sortCardSelected]}
                  activeOpacity={0.7}
                  onPress={() => setSort(option.key)}
                >
                  <Ionicons name={option.icon} size={26} color={isSelected ? colors.primary : colors.textGray} />
                  <Text style={[styles.sortCardText, isSelected && styles.sortCardTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          <View style={styles.priceHeaderRow}>
            <Text style={styles.sectionTitle}>Giá tối đa</Text>
            <Text style={styles.priceValue}>{priceLabel}</Text>
          </View>
          <PriceSlider value={maxPrice} onChange={setMaxPrice} />

        </ScrollView>

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.clearButton} activeOpacity={0.7} onPress={() => { clearAll(); onApply({}); onClose(); }}>
            <Text style={styles.clearButtonText}>Xóa tất cả</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} activeOpacity={0.85} onPress={() => { onApply({ sort: sort === 'rating' ? 'rating' : undefined, maxPrice: maxPrice < PRICE_MAX ? maxPrice : undefined }); onClose(); }}>
            <Text style={styles.applyButtonText}>Áp dụng</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: '85%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textDark,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  segmentGroup: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: 3,
    marginBottom: 24,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: colors.card,
    borderRadius: 19,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 19,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 14,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  sortCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  sortCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sortCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    textAlign: 'center',
  },
  sortCardTextSelected: {
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  priceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  sliderTrackWrap: {
    height: 28,
    justifyContent: 'center',
  },
  sliderTrackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sliderTrackFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sliderThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textBody,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
