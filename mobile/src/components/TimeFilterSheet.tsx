import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 250;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export type TimeFilterKey = 'any' | 'morning' | 'afternoon' | 'evening' | 'custom';

export interface CustomTimeRange {
  from: string;
  to: string;
}

export const TIME_FILTER_LABELS: Record<TimeFilterKey, string> = {
  any: 'Bất cứ lúc nào',
  morning: 'Sáng',
  afternoon: 'Chiều',
  evening: 'Tối',
  custom: 'Tùy chỉnh',
};

const OPTIONS: { key: TimeFilterKey; title: string; subtitle?: string }[] = [
  { key: 'any', title: 'Bất cứ lúc nào' },
  { key: 'morning', title: 'Sáng', subtitle: '9:00 - 12:00' },
  { key: 'afternoon', title: 'Chiều', subtitle: '12:00 - 18:00' },
  { key: 'evening', title: 'Tối', subtitle: '18:00 - 0:00' },
];

const HOURS = Array.from({ length: 24 }, (_, h) => `${h}:00`);
const DROPDOWN_ITEM_HEIGHT = 46;

function hourValue(hour: string): number {
  return parseInt(hour, 10);
}

interface Props {
  visible: boolean;
  selected: TimeFilterKey;
  customRange: CustomTimeRange | null;
  onApply: (key: TimeFilterKey, range?: CustomTimeRange) => void;
  onClose: () => void;
}

export default function TimeFilterSheet({ visible, selected, customRange, onApply, onClose }: Props) {
  const [isRendered, setIsRendered] = useState(visible);
  const [localSelected, setLocalSelected] = useState<TimeFilterKey>(selected);
  const [localFrom, setLocalFrom] = useState<string | null>(customRange?.from ?? null);
  const [localTo, setLocalTo] = useState<string | null>(customRange?.to ?? null);
  const [openDropdown, setOpenDropdown] = useState<'from' | 'to' | null>(null);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const fromScrollRef = useRef<ScrollView>(null);
  const toScrollRef = useRef<ScrollView>(null);
  const fromDropdownAnim = useRef(new Animated.Value(0)).current;
  const toDropdownAnim = useRef(new Animated.Value(0)).current;

  const toOptions = HOURS.filter((hour) => !localFrom || hourValue(hour) > hourValue(localFrom));

  useEffect(() => {
    if (openDropdown === 'from') {
      const index = localFrom ? HOURS.indexOf(localFrom) : 0;
      requestAnimationFrame(() => fromScrollRef.current?.scrollTo({ y: index * DROPDOWN_ITEM_HEIGHT, animated: false }));
      fromDropdownAnim.setValue(0);
      Animated.timing(fromDropdownAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    if (openDropdown === 'to') {
      const index = localTo ? toOptions.indexOf(localTo) : 0;
      requestAnimationFrame(() => toScrollRef.current?.scrollTo({ y: Math.max(0, index) * DROPDOWN_ITEM_HEIGHT, animated: false }));
      toDropdownAnim.setValue(0);
      Animated.timing(toDropdownAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDropdown]);

  useEffect(() => {
    if (visible) {
      setLocalSelected(selected);
      setLocalFrom(customRange?.from ?? null);
      setLocalTo(customRange?.to ?? null);
      setOpenDropdown(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <AnimatedTouchable style={[styles.backdrop, { opacity: backdropOpacity }]} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Thời gian</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {OPTIONS.map((option) => {
            const isSelected = option.key === localSelected;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.card, isSelected && styles.cardSelected]}
                activeOpacity={0.7}
                onPress={() => setLocalSelected(option.key)}
              >
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>{option.title}</Text>
                {option.subtitle && (
                  <Text style={[styles.cardSubtitle, isSelected && styles.cardSubtitleSelected]}>{option.subtitle}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.customRow, localSelected === 'custom' && styles.cardSelected]}
          activeOpacity={0.7}
          onPress={() => setLocalSelected('custom')}
        >
          <Text style={[styles.cardTitle, localSelected === 'custom' && styles.cardTitleSelected]}>Tùy chỉnh</Text>
          <Ionicons name="chevron-down" size={16} color={localSelected === 'custom' ? colors.primary : colors.textGray} />
        </TouchableOpacity>

        {localSelected === 'custom' && (
          <View style={styles.customRangeRow}>
            <View style={styles.rangeFieldWrap}>
              <TouchableOpacity
                style={styles.rangeField}
                activeOpacity={0.7}
                onPress={() => setOpenDropdown(openDropdown === 'from' ? null : 'from')}
              >
                <Text style={[styles.rangeFieldText, !localFrom && styles.rangeFieldPlaceholder]}>{localFrom ?? 'Từ'}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textGray} />
              </TouchableOpacity>
              {openDropdown === 'from' && (
                <Animated.View
                  style={[
                    styles.dropdown,
                    styles.dropdownUp,
                    {
                      opacity: fromDropdownAnim,
                      transform: [{ translateY: fromDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                    },
                  ]}
                >
                  <ScrollView ref={fromScrollRef} style={styles.dropdownScroll} nestedScrollEnabled>
                    {HOURS.map((hour) => {
                      const isSelected = hour === localFrom;
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={styles.dropdownItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            setLocalFrom(hour);
                            if (localTo && hourValue(localTo) <= hourValue(hour)) setLocalTo(null);
                            setOpenDropdown(null);
                          }}
                        >
                          <View style={styles.dropdownCheckWrap}>
                            {isSelected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                          </View>
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                            {hour}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              )}
            </View>

            <Text style={styles.rangeSeparator}>Đến</Text>

            <View style={styles.rangeFieldWrap}>
              <TouchableOpacity
                style={styles.rangeField}
                activeOpacity={0.7}
                onPress={() => setOpenDropdown(openDropdown === 'to' ? null : 'to')}
              >
                <Text style={[styles.rangeFieldText, !localTo && styles.rangeFieldPlaceholder]}>{localTo ?? 'Đến'}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textGray} />
              </TouchableOpacity>
              {openDropdown === 'to' && (
                <Animated.View
                  style={[
                    styles.dropdown,
                    styles.dropdownUp,
                    {
                      opacity: toDropdownAnim,
                      transform: [{ translateY: toDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                    },
                  ]}
                >
                  <ScrollView ref={toScrollRef} style={styles.dropdownScroll} nestedScrollEnabled>
                    {toOptions.map((hour) => {
                      const isSelected = hour === localTo;
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={styles.dropdownItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            setLocalTo(hour);
                            setOpenDropdown(null);
                          }}
                        >
                          <View style={styles.dropdownCheckWrap}>
                            {isSelected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                          </View>
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                            {hour}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              )}
            </View>
          </View>
        )}

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.clearButton}
            activeOpacity={0.7}
            onPress={() => {
              onApply('any');
              onClose();
            }}
          >
            <Text style={styles.clearButtonText}>Xóa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.applyButton,
              localSelected === 'custom' && (!localFrom || !localTo) && styles.applyButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={localSelected === 'custom' && (!localFrom || !localTo)}
            onPress={() => {
              onApply(localSelected, localSelected === 'custom' && localFrom && localTo ? { from: localFrom, to: localTo } : undefined);
              onClose();
            }}
          >
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
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    width: '47%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textGray,
  },
  cardTitleSelected: {
    color: colors.primary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardSubtitleSelected: {
    color: colors.primary,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 16,
  },
  customRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  rangeFieldWrap: {
    flex: 1,
    position: 'relative',
  },
  rangeField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rangeFieldText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  rangeFieldPlaceholder: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  rangeSeparator: {
    fontSize: 14,
    color: colors.textBody,
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
  },
  dropdownUp: {
    top: undefined,
    bottom: 52,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DROPDOWN_ITEM_HEIGHT,
    paddingHorizontal: 16,
    gap: 6,
  },
  dropdownCheckWrap: {
    width: 16,
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.textDark,
  },
  dropdownItemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
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
  applyButtonDisabled: {
    backgroundColor: colors.border,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
