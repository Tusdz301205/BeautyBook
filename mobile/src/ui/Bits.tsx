import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, families, familyOf, fonts, fw, radius, space, type } from '../theme';

/** Rating shown only when the API reports one; the caller decides whether to render it. */
export function RatingPill({ value, count, style }: { value: number; count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityLabel={`Đánh giá ${value.toFixed(1)} trên 5${count ? `, ${count} đánh giá` : ''}`} style={[styles.rating, style]}>
      <Ionicons accessible={false} name="star" size={13} color={colors.gold} />
      <Text style={styles.ratingText}>{value.toFixed(1)}</Text>
      {count ? <Text style={styles.ratingCount}>({count})</Text> : null}
    </View>
  );
}

/** Real photo when the API has one, otherwise initials on the person's/venue's family tint. */
export function Avatar({ uri, name, size = 48, familyName }: { uri?: string | null; name: string; size?: number; familyName?: string }) {
  const look = families[familyOf(familyName ?? name)];
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || '•';
  if (uri) return <Image source={{ uri }} accessibilityLabel={`Ảnh ${name}`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: look.soft }} />;
  return (
    <View accessible={false} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: look.soft }]}>
      <Text style={[styles.initials, { color: look.fg, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.5) }]}>{initials}</Text>
    </View>
  );
}

/** Small tinted label for a service family (icon + text). */
export function FamilyTag({ name, label }: { name?: string | null; label: string }) {
  const look = families[familyOf(name ?? label)];
  return (
    <View style={[styles.tag, { backgroundColor: look.soft }]}>
      <Ionicons accessible={false} name={look.icon as keyof typeof Ionicons.glyphMap} size={13} color={look.fg} />
      <Text style={[styles.tagText, { color: look.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  ratingText: { ...type.caption, ...fw.bold, color: colors.gold },
  ratingCount: { ...type.caption, color: colors.gold },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bold },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  tagText: { ...type.caption, ...fw.semibold, flexShrink: 1 },
});
