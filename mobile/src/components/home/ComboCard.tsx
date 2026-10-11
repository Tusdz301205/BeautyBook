import React from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../../theme';
import { Combo, formatCurrency } from '../../data/catalogModels';

interface Props {
  combo: Combo;
  width?: DimensionValue;
  onPress?: () => void;
}

/** Package card with real prices only; the discount badge appears only when the API reports one. */
export default function ComboCard({ combo, width = 240, onPress }: Props) {
  const discounted = combo.originalPrice > combo.price;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Gói ${combo.title} tại ${combo.shopName}, ${formatCurrency(combo.price)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.icon}><Ionicons accessible={false} name="gift-outline" size={18} color={colors.accent} /></View>
        {discounted && combo.discountPercent > 0 ? <Text style={styles.badge}>Giảm {combo.discountPercent}%</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{combo.title}</Text>
      <Text style={styles.shop} numberOfLines={1}>{combo.shopName}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatCurrency(combo.price)}</Text>
        {discounted ? <Text style={styles.original}>{formatCurrency(combo.originalPrice)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 156, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space.lg, gap: space.xs },
  pressed: { backgroundColor: colors.surfacePressed },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  icon: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  badge: { ...type.caption, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: 'hidden' },
  title: { ...type.h3 },
  shop: { ...type.secondary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, marginTop: 'auto', paddingTop: space.sm },
  price: { ...type.price, color: colors.primary },
  original: { ...type.caption, textDecorationLine: 'line-through' },
});
