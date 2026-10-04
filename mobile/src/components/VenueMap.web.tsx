import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { VenueMapProps } from './VenueMap';

export default function VenueMap({ onPress }: VenueMapProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Mở vị trí trên bản đồ" onPress={onPress} style={styles.fallback}><Text style={styles.text}>Xem vị trí trên bản đồ</Text></Pressable>;
}

const styles = StyleSheet.create({
  fallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBE8EF' },
  text: { color: '#9A275D', fontWeight: '700' },
});
