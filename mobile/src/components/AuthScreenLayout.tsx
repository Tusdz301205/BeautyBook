import React, { type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fw, layout, radius, space, type } from '../theme';
import { IconButton } from '../ui';
import { editorial } from './editorialArt';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack: () => void;
  /** Decorative editorial still life behind the plum veil (never an entity photo). */
  image?: ImageSourcePropType;
}

/** Photo hero under a plum veil (keeps white text ≥ AA) with the form on a rounded sheet. */
export default function AuthScreenLayout({ title, subtitle, children, onBack, image = editorial.authLogin }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Image source={image} accessible={false} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient pointerEvents="none" colors={['rgba(58,20,70,0.72)', 'rgba(58,20,70,0.95)']} style={styles.heroVeil} />
        <SafeAreaView edges={['top']}>
          <View style={styles.heroRow}>
            <IconButton icon="chevron-back" label="Quay lại" variant="scrim" onPress={onBack} />
            <Text style={styles.wordmark}>BeautyBook</Text>
            <View style={styles.spacer} />
          </View>
          <View style={styles.heroText}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </SafeAreaView>
      </View>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.secondary },
  hero: { paddingBottom: space.xxxl + space.md, overflow: 'hidden' },
  // Insets, not percentages: on native a percentage resolves against the padded content box and leaves a bare band.
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  heroVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, minHeight: layout.headerMinHeight },
  wordmark: { flex: 1, textAlign: 'center', ...type.h3, ...fw.display, fontSize: 19, color: colors.white },
  spacer: { width: layout.touch },
  heroText: { paddingHorizontal: layout.gutter + space.sm, paddingTop: space.md, gap: space.sm },
  title: { ...type.display, color: colors.white },
  subtitle: { ...type.body, color: colors.secondarySoft },
  sheet: { flex: 1, marginTop: -radius.sheet, backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, overflow: 'hidden' },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter + space.xs, paddingTop: space.xxl, paddingBottom: space.xxxl },
});
