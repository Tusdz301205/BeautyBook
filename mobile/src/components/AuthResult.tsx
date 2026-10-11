import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { space, tones, type } from '../theme';
import { AppButton } from '../ui';

/** Outcome block for auth flows (link sent, password changed, email verified). */
export default function AuthResult({ icon, title, message, actionLabel, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; message?: string; actionLabel: string; onAction: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.wrap}>
      <View style={styles.icon}><Ionicons accessible={false} name={icon} size={34} color={tones.success.fg} /></View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <AppButton label={actionLabel} onPress={onAction} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: tones.success.bg, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  title: { ...type.h2, textAlign: 'center' },
  message: { ...type.body, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: space.lg },
});
