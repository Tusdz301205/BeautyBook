import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius } from '../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Required: icon-only controls must announce their purpose. */
  label: string;
  onPress?: () => void;
  variant?: 'plain' | 'tonal' | 'scrim' | 'surface';
  color?: string;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const backgrounds = { plain: 'transparent', tonal: colors.primarySoft, scrim: 'rgba(42,18,48,0.5)', surface: colors.surface };

export default function IconButton({ icon, label, onPress, variant = 'plain', color, selected, disabled, style }: Props) {
  const tint = color ?? (variant === 'scrim' ? colors.white : colors.heading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.base, { backgroundColor: pressed ? (variant === 'scrim' ? 'rgba(42,18,48,0.72)' : colors.surfacePressed) : backgrounds[variant] }, variant === 'surface' && styles.border, style]}
    >
      <Ionicons name={icon} size={layout.iconLg} color={disabled ? colors.disabledText : tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: layout.touch, height: layout.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  border: { borderWidth: 1, borderColor: colors.border },
});
