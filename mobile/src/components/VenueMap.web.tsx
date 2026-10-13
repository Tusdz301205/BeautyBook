import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '../theme';

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
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở bản đồ ${title}`} onPress={onPress} style={({ pressed }) => [styles.map, pressed && { opacity: 0.85 }]}>
      <View style={styles.pin}><Ionicons accessible={false} name="location" size={22} color={colors.lavender} /></View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.address} numberOfLines={2}>{description}</Text>
        <Text style={styles.link}>Xem vị trí trên bản đồ</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  map: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md, backgroundColor: colors.lavenderSoft },
  pin: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...type.secondaryStrong, color: colors.heading },
  address: { ...type.caption },
  link: { ...type.secondaryStrong, color: colors.lavender, marginTop: space.xs },
});
