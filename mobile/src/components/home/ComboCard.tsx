import React from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { colors, elevation, radius, space, type, fw } from '../../theme';
import { ArtCover } from '../../ui';
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
      <View>
        <ArtCover name={combo.title} icon="gift-outline" height={76} />
        {discounted && combo.discountPercent > 0 ? <Text style={styles.badge}>Giảm {combo.discountPercent}%</Text> : null}
      </View>
      <View style={styles.body}>
      <Text style={styles.title} numberOfLines={2}>{combo.title}</Text>
      <Text style={styles.shop} numberOfLines={1}>{combo.shopName}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatCurrency(combo.price)}</Text>
        {discounted ? <Text style={styles.original}>{formatCurrency(combo.originalPrice)}</Text> : null}
      </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 196, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...elevation.card },
  body: { flex: 1, padding: space.md, gap: space.xs },
  pressed: { backgroundColor: colors.surfacePressed },
  badge: { position: 'absolute', right: space.sm, top: space.sm, ...type.caption, ...fw.bold, color: colors.accent, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: 'hidden' },
  title: { ...type.h3 },
  shop: { ...type.secondary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, marginTop: 'auto', paddingTop: space.sm },
  price: { ...type.price, color: colors.primary },
  original: { ...type.caption, textDecorationLine: 'line-through' },
});
