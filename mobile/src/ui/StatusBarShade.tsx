import React, { useState } from 'react';
import { StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme';

/** True once the screen has scrolled past `threshold`, i.e. its brand hero no longer sits behind the status bar. */
export function useStatusBarShade(threshold: number) {
  const [shaded, setShaded] = useState(false);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > threshold;
    setShaded((current) => (current === next ? current : next));
  };
  return { shaded, onScroll };
}

/** Plum strip behind the status bar, so its light icons stay readable over light content. Nothing on web (no inset). */
export function StatusBarShade({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets();
  if (!visible || insets.top <= 0) return null;
  return <LinearGradient pointerEvents="none" colors={[...gradients.dusk]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.shade, { height: insets.top }]} />;
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
});
