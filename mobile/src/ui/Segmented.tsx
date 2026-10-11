import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, type } from '../theme';

type Option<T extends string> = { key: T; label: string };

export default function Segmented<T extends string>({ options, value, onChange, style }: { options: Option<T>[]; value: T; onChange: (key: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="tablist" style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(option.key)} style={[styles.item, active && styles.active]}>
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: space.xs, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: space.xs },
  item: { flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  active: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { ...type.secondaryStrong, color: colors.secondaryText, textAlign: 'center' },
  labelActive: { color: colors.heading },
});
