import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';
import AppButton from './AppButton';

export function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction, secondaryLabel, onSecondary, style }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; message?: string | null; actionLabel?: string; onAction?: () => void;
  secondaryLabel?: string; onSecondary?: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}><Ionicons accessible={false} name={icon} size={28} color={colors.primary} /></View>
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
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.loadingText}>{message}</Text> : null}
    </View>
  );
}

/** Static placeholder (no shimmer) so it is calm and reduced-motion friendly. */
export function SkeletonBlock({ width = '100%', height, round }: { width?: DimensionValue; height: number; round?: boolean }) {
  return <View accessible={false} style={{ width, height, borderRadius: round ? radius.pill : radius.md, backgroundColor: colors.skeleton }} />;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: space.xxxl, gap: space.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  emptyTitle: { ...type.h3, textAlign: 'center' },
  emptyMessage: { ...type.secondary, textAlign: 'center', maxWidth: 320 },
  emptyAction: { marginTop: space.sm, alignSelf: 'stretch' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  loadingText: { ...type.secondary, textAlign: 'center' },
});
