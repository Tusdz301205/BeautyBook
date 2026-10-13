import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, type } from '../theme';

/** Shared native-stack header for Staff and Owner detail screens. */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerTintColor: colors.heading,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontSize: type.h3.fontSize, fontFamily: type.h3.fontFamily, color: colors.heading },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.background },
};
