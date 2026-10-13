import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, tones, type } from '../theme';
import AppButton from './AppButton';

type NoticeTone = 'info' | 'warning' | 'error' | 'success' | 'neutral' | 'brand';
type Props = {
  tone?: NoticeTone;
  title?: string;
  message?: string | null;
  children?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

const map = {
  info: { tone: tones.info, icon: 'information-circle-outline' },
  warning: { tone: tones.warning, icon: 'warning-outline' },
  error: { tone: tones.danger, icon: 'alert-circle-outline' },
  success: { tone: tones.success, icon: 'checkmark-circle-outline' },
  neutral: { tone: tones.neutral, icon: 'information-circle-outline' },
  brand: { tone: tones.brand, icon: 'sparkles-outline' },
} as const;

export default function Notice({ tone = 'info', title, message, children, actionLabel, onAction, style }: Props) {
  const meta = map[tone];
  return (
    <View accessibilityLiveRegion="polite" style={[styles.box, { backgroundColor: meta.tone.bg, borderColor: meta.tone.border }, style]}>
      <View style={styles.row}>
        <Ionicons accessible={false} name={meta.icon} size={20} color={meta.tone.fg} style={styles.icon} />
        <View style={styles.flex}>
          {title ? <Text style={[styles.title, { color: meta.tone.fg }]}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children}
        </View>
      </View>
      {actionLabel && onAction ? <AppButton compact variant="outline" label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  icon: { marginTop: 2 },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  title: { ...type.secondaryStrong },
  message: { ...type.secondary, color: colors.body },
  action: { alignSelf: 'flex-start' },
});
