import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, space, type } from '../theme';
import IconButton from './IconButton';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
  /** Tab roots use a large left-aligned title; stacked screens use a compact centred one. */
  large?: boolean;
  inset?: boolean;
  backDisabled?: boolean;
};

export default function ScreenHeader({ title, subtitle, onBack, backLabel = 'Quay lại', right, large, inset = true, backDisabled }: Props) {
  const content = large ? (
    <View style={styles.large}>
      <View style={styles.flex}>
        <Text accessibilityRole="header" style={styles.largeTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.rightLarge}>{right}</View> : null}
    </View>
  ) : (
    <View style={styles.row}>
      <View style={styles.side}>{onBack ? <IconButton icon="chevron-back" label={backLabel} onPress={onBack} disabled={backDisabled} /> : null}</View>
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitleCenter}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
  return inset ? <SafeAreaView edges={['top']} style={styles.wrap}>{content}</SafeAreaView> : <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.background },
  row: { minHeight: layout.headerMinHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  side: { width: layout.touch + space.xs, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: space.xs },
  title: { ...type.h3, textAlign: 'center' },
  subtitleCenter: { ...type.caption, textAlign: 'center' },
  large: { minHeight: layout.headerMinHeight, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.md },
  largeTitle: { ...type.h1 },
  subtitle: { ...type.secondary, marginTop: space.xxs },
  rightLarge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
});
