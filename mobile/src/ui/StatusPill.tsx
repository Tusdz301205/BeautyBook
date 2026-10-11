import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, tones, type, type Tone } from '../theme';

type Props = { label: string; tone?: Tone; icon?: string; large?: boolean };

/** Colour is paired with an icon and words, never used alone as a status signal. */
export default function StatusPill({ label, tone = 'neutral', icon, large }: Props) {
  const palette = tones[tone];
  return (
    <View style={[styles.pill, large && styles.large, { backgroundColor: palette.bg }]}>
      {icon ? <Ionicons accessible={false} name={icon as keyof typeof Ionicons.glyphMap} size={large ? 16 : 14} color={palette.fg} /> : null}
      <Text style={[styles.label, large && styles.largeLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: space.xs, maxWidth: '100%' },
  large: { paddingHorizontal: space.md, paddingVertical: 6 },
  label: { ...type.caption, fontWeight: '600', flexShrink: 1 },
  largeLabel: { fontSize: 14, lineHeight: 20 },
});
