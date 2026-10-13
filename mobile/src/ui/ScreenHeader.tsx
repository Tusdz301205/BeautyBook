import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fw, layout, radius, space, type } from '../theme';
import BrandGradient from './BrandGradient';
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
  /** Plum → berry band with white title (customer tab roots). */
  brand?: boolean;
};

export default function ScreenHeader({ title, subtitle, onBack, backLabel = 'Quay lại', right, large, inset = true, backDisabled, brand }: Props) {
  const insets = useSafeAreaInsets();
  if (brand) {
    // Tab roots in the customer shell: compact brand band with white text.
    return (
      <BrandGradient decor style={[styles.brand, { paddingTop: (inset ? insets.top : 0) + space.md }]}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.largeTitle, styles.onBrand]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, styles.onBrandSoft]}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.rightLarge}>{right}</View> : null}
      </BrandGradient>
    );
  }
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
  title: { ...type.h3, ...fw.display, fontSize: 19, textAlign: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.gutter, paddingBottom: space.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  onBrand: { color: colors.white },
  onBrandSoft: { color: colors.secondarySoft },
  subtitleCenter: { ...type.caption, textAlign: 'center' },
  large: { minHeight: layout.headerMinHeight, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.md },
  largeTitle: { ...type.h1 },
  subtitle: { ...type.secondary, marginTop: space.xxs },
  rightLarge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
});
