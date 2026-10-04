import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { Combo, formatCurrency } from '../../data/catalogModels';
import PlaceholderCover from '../PlaceholderCover';
import Card, { CardCover } from '../Card';

interface Props {
  combo: Combo;
  width?: number;
  onPress?: () => void;
}

export default function ComboCard({ combo, width = 230, onPress }: Props) {
  return (
    <Card width={width} onPress={onPress}>
      <CardCover>
        <PlaceholderCover seed={combo.id} label={combo.logoText} icon="pricetag-outline" height={110} />
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{combo.discountPercent}%</Text>
        </View>
      </CardCover>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {combo.title}
        </Text>
        <View style={styles.row}>
          <Ionicons name="home-outline" size={13} color={colors.textGray} />
          <Text style={styles.shopName} numberOfLines={1}>
            {combo.shopName}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Ionicons name="sunny-outline" size={13} color={colors.primary} />
          <Text style={styles.price}>{formatCurrency(combo.price)}</Text>
          <Text style={styles.originalPrice}>{formatCurrency(combo.originalPrice)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  discountBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.discountRed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomLeftRadius: 12,
  },
  discountText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  body: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shopName: {
    fontSize: 13,
    color: colors.textGray,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
