import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, type, fw } from '../theme';

type Props = {
  label: string;
  detail?: string;
  value?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  divider?: boolean;
  accessibilityHint?: string;
  right?: React.ReactNode;
};

export default function ListRow({ label, detail, value, icon, onPress, danger, chevron = Boolean(onPress), divider, accessibilityHint, right }: Props) {
  const fg = danger ? colors.error : colors.heading;
  const body = (
    <>
      {icon ? <View style={[styles.icon, danger && { backgroundColor: colors.errorSoft }]}><Ionicons accessible={false} name={icon} size={layout.iconMd} color={danger ? colors.error : colors.secondary} /></View> : null}
      <View style={styles.text}>
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {right}
      {chevron ? <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, divider && styles.divider]}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityHint={accessibilityHint} onPress={onPress} style={({ pressed }) => [styles.row, divider && styles.divider, pressed && { backgroundColor: colors.surfacePressed }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.cardPadding, paddingVertical: space.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  label: { ...type.bodyStrong, ...fw.medium },
  detail: { ...type.secondary, marginTop: 2 },
  value: { ...type.secondary, maxWidth: '45%', textAlign: 'right' },
});
