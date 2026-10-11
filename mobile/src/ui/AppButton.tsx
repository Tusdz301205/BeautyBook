import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, type } from '../theme';

export type ButtonVariant = 'primary' | 'tonal' | 'outline' | 'ghost' | 'danger' | 'dangerOutline' | 'onDark';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  compact?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  tonal: { bg: colors.primarySoft, pressed: '#EED6E2', fg: colors.primary },
  outline: { bg: colors.surface, pressed: colors.surfacePressed, fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', pressed: colors.surfacePressed, fg: colors.primary },
  danger: { bg: colors.error, pressed: '#82211B', fg: colors.white },
  dangerOutline: { bg: colors.surface, pressed: colors.errorSoft, fg: colors.error, border: colors.error },
  onDark: { bg: colors.white, pressed: colors.secondarySoft, fg: colors.secondary },
};

export default function AppButton({ label, onPress, variant = 'primary', compact, icon, iconRight, loading, disabled, accessibilityLabel, accessibilityHint, style }: Props) {
  const tone = palette[variant];
  const inactive = Boolean(disabled || loading);
  const solid = variant === 'primary' || variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? tone.pressed : tone.bg },
        tone.border ? { borderWidth: 1.5, borderColor: tone.border } : null,
        disabled && !loading && (solid ? styles.disabledSolid : styles.disabledSoft),
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.fg} /> : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={layout.iconMd} color={disabled ? colors.disabledText : tone.fg} /> : null}
          <Text style={[styles.label, { color: disabled ? colors.disabledText : tone.fg }]}>{label}</Text>
          {iconRight ? <Ionicons name={iconRight} size={layout.iconMd} color={disabled ? colors.disabledText : tone.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: layout.buttonMinHeight, borderRadius: radius.md, paddingHorizontal: space.xl, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: layout.buttonCompactMinHeight, paddingHorizontal: space.lg },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, flexShrink: 1 },
  label: { ...type.button, textAlign: 'center', flexShrink: 1 },
  disabledSolid: { backgroundColor: colors.disabledSurface, borderWidth: 0 },
  disabledSoft: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface },
});
