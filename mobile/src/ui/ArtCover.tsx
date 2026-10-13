import React from 'react';
import { StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { families, familyOf, fonts, type FamilyKey } from '../theme';

type Props = {
  /** Category / service / venue name used to pick the colour family deterministically. */
  name?: string | null;
  family?: FamilyKey;
  /** Up to two letters shown as a monogram (e.g. venue initials). */
  monogram?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  height?: DimensionValue;
  width?: DimensionValue;
  rounded?: number;
  /** Space at the bottom covered by an overlapping sheet (keeps the art centred above it). */
  inset?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Designed stand-in when the API has no photo: a tinted composition in the
 * service family's colours. It never imitates a real venue or staff photo and
 * replaces the old empty “chưa có ảnh” boxes.
 */
export default function ArtCover({ name, family, monogram, icon, height = 120, width = '100%', rounded = 0, inset = 0, accessibilityLabel, style }: Props) {
  const look = families[family ?? familyOf(name)];
  // Small thumbnails drop the badge so the icon stays legible.
  const compact = typeof height === 'number' && height <= 72;
  const glyph = (icon ?? look.icon) as keyof typeof Ionicons.glyphMap;
  return (
    <LinearGradient
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      colors={[look.stops[0], look.stops[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cover, { height, width, borderRadius: rounded, paddingBottom: inset }, style]}
    >
      {compact ? (
        <>
          <View pointerEvents="none" style={[styles.circle, styles.circleTiny]} />
          <Ionicons accessible={false} name={glyph} size={Math.round((height as number) * 0.44)} color={look.fg} />
        </>
      ) : (
        <>
          <View pointerEvents="none" style={[styles.circle, styles.circleLarge]} />
          <View pointerEvents="none" style={[styles.circle, styles.circleSmall]} />
          <View pointerEvents="none" style={[styles.arc, { borderColor: look.fg }]} />
          <View style={styles.badge}>
            {monogram ? <Text style={[styles.monogram, { color: look.fg }]}>{monogram.slice(0, 2).toUpperCase()}</Text> : <Ionicons accessible={false} name={glyph} size={24} color={look.fg} />}
          </View>
          {monogram ? <View style={[styles.corner, { bottom: 12 + inset }]}><Ionicons accessible={false} name={glyph} size={16} color={look.fg} /></View> : null}
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.38)' },
  circleLarge: { width: 150, height: 150, right: -44, top: -56 },
  circleSmall: { width: 84, height: 84, left: -22, bottom: -30 },
  circleTiny: { width: 44, height: 44, right: -14, top: -16 },
  corner: { position: 'absolute', left: 12, bottom: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  arc: { position: 'absolute', width: 110, height: 110, borderRadius: 55, left: '18%', top: '-30%', borderWidth: 1.5, opacity: 0.18 },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.82)', alignItems: 'center', justifyContent: 'center' },
  monogram: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
});
