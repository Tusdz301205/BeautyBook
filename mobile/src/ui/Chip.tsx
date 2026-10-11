import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, type } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  disabled?: boolean;
  role?: 'button' | 'radio' | 'tab' | 'checkbox';
};

export default function Chip({ label, selected, onPress, onRemove, icon, accessibilityLabel, disabled, role = 'button' }: Props) {
  const fg = disabled ? colors.disabledText : selected ? colors.onSecondary : colors.heading;
  return (
    <View style={[styles.chip, selected ? styles.selected : styles.idle, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole={role}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={role === 'checkbox' || role === 'radio' ? { checked: Boolean(selected), disabled } : { selected: Boolean(selected), disabled }}
        disabled={disabled || !onPress}
        onPress={onPress}
        style={styles.main}
      >
        {icon ? <Ionicons accessible={false} name={icon} size={16} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Bỏ lọc ${label}`} onPress={onRemove} hitSlop={6} style={styles.remove}>
          <Ionicons name="close" size={16} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  idle: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  selected: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  disabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface },
  main: { minHeight: layout.touch - 8, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingHorizontal: space.md + 2, paddingVertical: space.xs },
  label: { ...type.secondaryStrong },
  remove: { minHeight: 40, minWidth: 36, alignItems: 'center', justifyContent: 'center', paddingRight: space.sm },
});
