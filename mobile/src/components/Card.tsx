import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../constants/colors';

const CARD_RADIUS = 14;

interface CardProps {
  children: React.ReactNode;
  width?: number | `${number}%`;
  style?: ViewStyle;
  onPress?: () => void;
}

export default function Card({ children, width, style, onPress }: CardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, width !== undefined && { width }, style]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {children}
    </TouchableOpacity>
  );
}

interface CardCoverProps {
  children: React.ReactNode;
}

export function CardCover({ children }: CardCoverProps) {
  return <View style={styles.cover}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cover: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: CARD_RADIUS - 1,
    borderTopRightRadius: CARD_RADIUS - 1,
  },
});
