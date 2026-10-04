import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface DayMark {
  hasUpcoming: boolean;
  hasCompleted: boolean;
  hasCancelled: boolean;
}

interface Props {
  visibleMonth: Date;
  onChangeMonth: (date: Date) => void;
  selectedDateKey: string;
  onSelectDate: (key: string) => void;
  marks: Record<string, DayMark>;
}

export default function AppointmentCalendar({
  visibleMonth,
  onChangeMonth,
  selectedDateKey,
  onSelectDate,
  marks,
}: Props) {
  const today = new Date();

  const weeks = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - firstWeekday);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [visibleMonth]);

  const goPrevMonth = () => onChangeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1));
  const goNextMonth = () => onChangeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1));
  const goToday = () => onChangeMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <TouchableOpacity activeOpacity={0.7} onPress={goToday}>
          <Text style={styles.monthLabel}>
            {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
          </Text>
        </TouchableOpacity>
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navButton} activeOpacity={0.7} onPress={goPrevMonth} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.textDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} activeOpacity={0.7} onPress={goNextMonth} hitSlop={8}>
            <Ionicons name="chevron-forward" size={18} color={colors.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day) => {
            const key = dateKey(day);
            const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
            const isSelected = key === selectedDateKey;
            const isToday = isSameDay(day, today);
            const mark = marks[key];

            return (
              <TouchableOpacity key={key} style={styles.dayCell} activeOpacity={0.7} onPress={() => onSelectDate(key)}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    !isSelected && isToday && styles.dayCircleToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isCurrentMonth && styles.dayTextMuted,
                      isSelected && styles.dayTextSelected,
                      !isSelected && isToday && styles.dayTextToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                {mark ? (
                  <View style={styles.dotsRow}>
                    {mark.hasUpcoming && <View style={[styles.dot, { backgroundColor: colors.reviewTag }]} />}
                    {mark.hasCompleted && <View style={[styles.dot, { backgroundColor: colors.ratingGreen }]} />}
                    {mark.hasCancelled && <View style={[styles.dot, { backgroundColor: colors.discountRed }]} />}
                  </View>
                ) : (
                  <View style={styles.dotsRowPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textDark,
  },
  monthNav: {
    flexDirection: 'row',
    gap: 6,
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textGray,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.primary,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  dayTextMuted: {
    color: colors.textMuted,
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotsRowPlaceholder: {
    height: 5,
  },
});
