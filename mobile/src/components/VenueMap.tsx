import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export interface VenueMapProps {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  onPress: () => void;
}

export default function VenueMap({ title, description, onPress }: VenueMapProps) {
  // The shipped Android manifest has no Google Maps API key. A native Google
  // map can terminate the app before React can recover; use the external map.
  return <Pressable accessibilityRole="button" accessibilityLabel={`Mở bản đồ ${title}`} onPress={onPress} style={styles.map}><Text style={styles.title}>{title}</Text><Text style={styles.address}>{description}</Text><Text style={styles.link}>Xem vị trí trên bản đồ</Text></Pressable>;
}

const styles = StyleSheet.create({ map: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8, backgroundColor: '#FBE8EF' }, title: { fontSize: 17, fontWeight: '700', textAlign: 'center', color: '#422737' }, address: { fontSize: 14, textAlign: 'center', color: '#594653' }, link: { fontSize: 15, fontWeight: '700', color: '#9A275D' } });
