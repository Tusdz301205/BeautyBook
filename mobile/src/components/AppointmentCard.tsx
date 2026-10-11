import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { Appointment, OVERDUE_META, bookingStatusMeta, isPastUpcoming } from '../data/appointments';
import { AppButton, StatusPill } from '../ui';

interface Props {
  item: Appointment;
  onPress: () => void;
  onRebook?: () => void;
}

export default function AppointmentCard({ item, onPress, onRebook }: Props) {
  const pastPending = isPastUpcoming(item) && ['PENDING', 'CONFIRMED'].includes(item.rawStatus || '');
  const meta = pastPending ? OVERDUE_META : bookingStatusMeta(item.status, item.rawStatus);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.shopName}, ${item.comboTitle}, ${item.date} lúc ${item.time}, ${meta.label}. Xem chi tiết`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.timeCol}>
          <Text style={styles.time}>{item.time}</Text>
          <Text style={styles.date}>{item.date.slice(0, 5)}</Text>
        </View>
        <View style={styles.body}>
          <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} />
          <Text style={styles.service}>{item.comboTitle}</Text>
          <Text style={styles.meta}>{item.shopName}</Text>
          <View style={styles.row}>
            <Ionicons accessible={false} name="person-outline" size={14} color={colors.secondaryText} />
            <Text style={styles.meta}>{item.staffName}</Text>
          </View>
          <Text style={styles.price}>{formatCurrency(item.price)}</Text>
        </View>
        <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} />
      </Pressable>
      {onRebook ? <View style={styles.footer}><AppButton compact variant="tonal" icon="refresh-outline" label="Đặt lại" accessibilityLabel={`Đặt lại ${item.comboTitle}`} onPress={onRebook} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: space.md, overflow: 'hidden' },
  main: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  pressed: { backgroundColor: colors.surfacePressed },
  timeCol: { width: 52, alignSelf: 'flex-start', paddingTop: 2 },
  time: { ...type.clock },
  date: { ...type.caption },
  body: { flex: 1, minWidth: 0, gap: space.xs },
  service: { ...type.h3 },
  meta: { ...type.secondary, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  price: { ...type.price, marginTop: 2 },
  footer: { borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: space.lg, paddingVertical: space.sm, alignItems: 'flex-end' },
});
