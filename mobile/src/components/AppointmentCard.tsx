import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import { Appointment, bookingStatusMeta, isPastUpcoming } from '../data/appointments';

interface Props {
  item: Appointment;
  onPress: () => void;
  onRebook?: () => void;
}

export default function AppointmentCard({ item, onPress, onRebook }: Props) {
  const pastPending = isPastUpcoming(item) && ['PENDING', 'CONFIRMED'].includes(item.rawStatus || '');
  const meta = pastPending
    ? { label: 'Quá hạn · chờ cập nhật', color: colors.textGray, background: colors.background }
    : bookingStatusMeta(item.status, item.rawStatus);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
      <View style={styles.cardContent}>
        {!!item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.cardImage} />}
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.shopName}>
              {item.shopName}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: meta.background }]}>
              <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={styles.comboTitle}>
            {item.comboTitle}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textGray} />
            <Text style={styles.metaText}>
              {item.time} • {item.staffName}
            </Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text style={styles.price}>{formatCurrency(item.price)}</Text>
            {onRebook && (
              <TouchableOpacity style={styles.rebookButton} activeOpacity={0.8} onPress={onRebook}>
                <Text style={styles.rebookButtonText}>Đặt lại</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardAccent: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 12,
  },
  cardImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTopRow: {
    alignItems: 'flex-start',
    gap: 8,
  },
  shopName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  comboTitle: {
    fontSize: 15,
    color: colors.textBody,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 14,
    color: colors.textGray,
    flexShrink: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  rebookButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rebookButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
