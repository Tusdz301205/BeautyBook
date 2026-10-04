import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../constants/colors';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  onBack: () => void;
}

export default function AuthScreenLayout({ title, subtitle, children, onBack }: Props) {
  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#E8477B', '#FF8FB3']} style={styles.hero}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="sparkles" size={27} color={colors.primary} />
            </View>
            <Text style={styles.brand}>BeautyBook</Text>
          </View>
        </SafeAreaView>
        <View style={styles.circleLarge} />
        <View style={styles.circleSmall} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { height: 230, overflow: 'hidden' },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 28,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: colors.white, fontSize: 28, fontWeight: '900', letterSpacing: 0.2 },
  circleLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.10)',
    right: -55,
    top: -35,
  },
  circleSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.10)',
    left: -20,
    bottom: -22,
  },
  // Move the scroll viewport itself over the hero. A negative margin on the
  // card gets clipped by ScrollView on Android and cuts off the page title.
  keyboard: { flex: 1, marginTop: -38 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 28,
  },
  card: {
    borderRadius: 28,
    backgroundColor: colors.card,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 28,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  title: {
    color: colors.textDark,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: { color: colors.textGray, fontSize: 15, lineHeight: 22, marginBottom: 26 },
});
