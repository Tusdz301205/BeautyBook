import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function SectionCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    paddingTop: 16,
    paddingBottom: 12,
  },
});
