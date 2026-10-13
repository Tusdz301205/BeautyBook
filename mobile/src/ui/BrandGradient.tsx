import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme';

type Props = {
  name?: keyof typeof gradients;
  /** Soft translucent shapes that give brand surfaces depth without animation. */
  decor?: boolean;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/** Brand gradient surface (plum → berry by default). Static, so reduced-motion needs no special case. */
export default function BrandGradient({ name = 'brand', decor, horizontal, style, children }: Props) {
  return (
    <LinearGradient colors={[...gradients[name]] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={horizontal ? { x: 1, y: 0 } : { x: 1, y: 1 }} style={[styles.base, style]}>
      {decor ? (
        <View pointerEvents="none" style={styles.decor}>
          <View style={[styles.blob, styles.blobPeach]} />
          <View style={[styles.blob, styles.blobLilac]} />
          <View style={[styles.ring]} />
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  decor: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobPeach: { width: 220, height: 220, right: -70, top: -90, backgroundColor: 'rgba(255,181,156,0.26)' },
  blobLilac: { width: 160, height: 160, left: -60, bottom: -80, backgroundColor: 'rgba(188,169,243,0.24)' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: 36, bottom: -64, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
});
