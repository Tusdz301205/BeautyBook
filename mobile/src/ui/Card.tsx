import React from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, layout, radius } from '../theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  tone?: 'surface' | 'muted' | 'brand' | 'plum';
  padded?: boolean;
  raised?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<ViewStyle>;
};

const backgrounds = { surface: colors.surface, muted: colors.surfaceMuted, brand: colors.primarySoft, plum: colors.secondary };

export default function Card({ children, onPress, tone = 'surface', padded = true, raised, accessibilityLabel, accessibilityHint, accessibilityRole, style }: Props) {
  const base = [styles.card, { backgroundColor: backgrounds[tone] }, tone === 'surface' && styles.border, padded && styles.padded, raised && elevation.card];
  if (!onPress) return <View accessibilityLabel={accessibilityLabel} style={[...base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && { backgroundColor: tone === 'plum' ? '#2E1A27' : tone === 'surface' ? colors.surfacePressed : colors.secondarySoft }, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  border: { borderWidth: 1, borderColor: colors.border },
  padded: { padding: layout.cardPadding },
});
