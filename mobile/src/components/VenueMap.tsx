import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export interface VenueMapProps {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  onPress: () => void;
}

export default function VenueMap({ latitude, longitude, title, description, onPress }: VenueMapProps) {
  return <MapView provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} style={StyleSheet.absoluteFill} initialRegion={{ latitude, longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false} onPress={onPress}>
    <Marker coordinate={{ latitude, longitude }} title={title} description={description} />
  </MapView>;
}
