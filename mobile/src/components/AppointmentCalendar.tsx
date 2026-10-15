import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, tones, type, fw } from '../theme';
import { AppButton, IconButton } from '../ui';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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

const DOTS = { upcoming: tones.info.fg, completed: tones.success.fg, cancelled: tones.neutral.fg };

export default function AppointmentCalendar({ visibleMonth, onChangeMonth, selectedDateKey, onSelectDate, marks }: Props) {
  const today = new Date();

  const weeks = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - firstWeekday);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [visibleMonth]);

  const goPrevMonth = () => onChangeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1));
  const goNextMonth = () => onChangeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1));
  const goToday = () => { onChangeMonth(new Date(today.getFullYear(), today.getMonth(), 1)); onSelectDate(dateKey(today)); };

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <IconButton icon="chevron-back" label="Tháng trước" onPress={goPrevMonth} />
        <Text accessibilityRole="header" style={styles.monthLabel}>Tháng {visibleMonth.getMonth() + 1}/{visibleMonth.getFullYear()}</Text>
        <IconButton icon="chevron-forward" label="Tháng sau" onPress={goNextMonth} />
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => <Text key={label} style={styles.weekdayLabel}>{label}</Text>)}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day) => {
            const key = dateKey(day);
            const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
            const isSelected = key === selectedDateKey;
            const isToday = isSameDay(day, today);
            const mark = marks[key];
            const markLabel = mark ? [mark.hasUpcoming && 'có lịch sắp tới', mark.hasCompleted && 'có lịch sử lịch hẹn', mark.hasCancelled && 'có lịch đã hủy'].filter(Boolean).join(', ') : 'không có lịch';
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${day.getDate()}/${day.getMonth() + 1}${isToday ? ', hôm nay' : ''}, ${markLabel}`}
                accessibilityState={{ selected: isSelected }}
                style={styles.dayCell}
                onPress={() => onSelectDate(key)}
              >
                <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected, !isSelected && isToday && styles.dayCircleToday]}>
                  <Text style={[styles.dayText, !isCurrentMonth && styles.dayTextMuted, isSelected && styles.dayTextSelected, !isSelected && isToday && styles.dayTextToday]}>{day.getDate()}</Text>
                </View>
                <View style={styles.dotsRow}>
                  {mark?.hasUpcoming ? <View style={[styles.dot, { backgroundColor: DOTS.upcoming }]} /> : null}
                  {mark?.hasCompleted ? <View style={[styles.dot, { backgroundColor: DOTS.completed }]} /> : null}
                  {mark?.hasCancelled ? <View style={[styles.dot, { backgroundColor: DOTS.cancelled }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <View style={styles.legend}>
          <Legend color={DOTS.upcoming} label="Sắp tới" />
          <Legend color={DOTS.completed} label="Lịch sử" />
          <Legend color={DOTS.cancelled} label="Đã hủy" />
        </View>
        <AppButton compact variant="ghost" label="Hôm nay" onPress={goToday} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  monthLabel: { ...type.h3, flex: 1, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row', marginBottom: space.xs },
  weekdayLabel: { flex: 1, textAlign: 'center', ...type.caption, ...fw.semibold },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { ...type.secondaryStrong, color: colors.heading, fontVariant: ['tabular-nums'] },
  dayTextMuted: { color: colors.disabledText, ...fw.regular },
  dayTextSelected: { color: colors.onPrimary },
  dayTextToday: { color: colors.primary },
  dotsRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendText: { ...type.caption },
});
