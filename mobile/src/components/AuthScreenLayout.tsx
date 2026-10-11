import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radius, space, type } from '../theme';
import { IconButton } from '../ui';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  onBack: () => void;
}

/** Plum brand header + calm form surface (replaces the neon gradient hero). */
export default function AuthScreenLayout({ title, subtitle, children, onBack }: Props) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={styles.heroRow}>
          <IconButton icon="chevron-back" label="Quay lại" variant="scrim" onPress={onBack} />
          <Text style={styles.wordmark}>BeautyBook</Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.heroText}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  hero: { backgroundColor: colors.secondary, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, paddingBottom: space.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, minHeight: layout.headerMinHeight },
  wordmark: { flex: 1, textAlign: 'center', ...type.h3, color: colors.secondarySoft, letterSpacing: 0.3 },
  spacer: { width: layout.touch },
  heroText: { paddingHorizontal: layout.gutter + space.sm, paddingTop: space.sm, gap: space.sm },
  title: { ...type.display, color: colors.white },
  subtitle: { ...type.body, color: colors.secondarySoft },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter + space.xs, paddingTop: space.xxl, paddingBottom: space.xxxl },
});
