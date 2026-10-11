import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';
import { SheetModal } from '../ui';

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  columns?: 1 | 2;
}

export default function SelectListSheet({ visible, title, options, selectedValue, onSelect, onClose, columns = 1 }: Props) {
  return (
    <SheetModal visible={visible} title={title} onClose={onClose}>
      <View accessibilityRole="radiogroup" style={[styles.list, columns === 2 && styles.grid]}>
        {options.map((option) => {
          const selected = option === selectedValue;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [styles.item, columns === 2 && styles.half, selected && styles.selected, pressed && !selected && styles.pressed]}
            >
              <Ionicons accessible={false} name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.borderStrong} />
              <Text style={[styles.text, selected && styles.textSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  item: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  half: { width: '48.5%' },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { backgroundColor: colors.surfacePressed },
  text: { ...type.body, color: colors.heading, flex: 1 },
  textSelected: { fontWeight: '600', color: colors.primary },
});
