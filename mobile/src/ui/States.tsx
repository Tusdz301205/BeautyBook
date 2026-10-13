import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, tones, type, type Tone } from '../theme';
import AppButton from './AppButton';

/** Layered tinted medallion: gives empty/error states colour and warmth without a stock illustration. */
export function Medallion({ icon, tone = 'brand', size = 88 }: { icon: keyof typeof Ionicons.glyphMap; tone?: Tone; size?: number }) {
  const palette = tones[tone];
  return (
    <View accessible={false} style={{ width: size + 28, height: size + 12, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.petal, { width: size * 0.62, height: size * 0.62, backgroundColor: colors.accentSoft, left: 0, top: 0 }]} />
      <View style={[styles.petal, { width: size * 0.5, height: size * 0.5, backgroundColor: colors.lavenderSoft, right: 0, bottom: 0 }]} />
      <View style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg, borderColor: colors.surface }]}>
        <Ionicons name={icon} size={Math.round(size * 0.4)} color={palette.fg} />
      </View>
    </View>
  );
}

export function EmptyState({ icon = 'sparkles-outline', tone = 'brand', title, message, actionLabel, onAction, secondaryLabel, onSecondary, style }: {
  icon?: keyof typeof Ionicons.glyphMap; tone?: Tone; title: string; message?: string | null; actionLabel?: string; onAction?: () => void;
  secondaryLabel?: string; onSecondary?: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.empty, style]}>
      <Medallion icon={icon} tone={tone} />
      <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionLabel && onAction ? <AppButton label={actionLabel} onPress={onAction} style={styles.emptyAction} /> : null}
      {secondaryLabel && onSecondary ? <AppButton variant="ghost" label={secondaryLabel} onPress={onSecondary} /> : null}
    </View>
  );
}

export function LoadingState({ message, style }: { message?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.loading, style]}>
      <View style={styles.loadingRing}><ActivityIndicator size="large" color={colors.primary} /></View>
      {message ? <Text style={styles.loadingText}>{message}</Text> : null}
    </View>
  );
}

/** Static placeholder (no shimmer) so it is calm and reduced-motion friendly. */
export function SkeletonBlock({ width = '100%', height, round }: { width?: DimensionValue; height: number; round?: boolean }) {
  return <View accessible={false} style={{ width, height, borderRadius: round ? radius.pill : radius.md, backgroundColor: colors.skeleton }} />;
}

const styles = StyleSheet.create({
  petal: { position: 'absolute', borderRadius: 999 },
  core: { alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: space.xxxl, gap: space.sm },
  emptyTitle: { ...type.h2, textAlign: 'center', marginTop: space.sm },
  emptyMessage: { ...type.secondary, textAlign: 'center', maxWidth: 320 },
  emptyAction: { marginTop: space.md, alignSelf: 'stretch' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  loadingRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...type.secondary, textAlign: 'center' },
});
