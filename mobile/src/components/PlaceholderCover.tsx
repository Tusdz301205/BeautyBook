import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { placeholderPalette } from '../constants/colors';
import { hashString } from '../utils/hash';

interface Props {
  seed: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  height?: number;
}

export default function PlaceholderCover({ seed, label, icon = 'sparkles-outline', height = 96 }: Props) {
  const color = placeholderPalette[hashString(seed) % placeholderPalette.length];

  return (
    <View style={[styles.container, { backgroundColor: color, height }]}>
      <Ionicons name={icon} size={22} color="rgba(255,255,255,0.85)" style={styles.icon} />
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  icon: {
    marginBottom: 4,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
