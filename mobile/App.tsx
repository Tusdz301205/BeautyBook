import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import RootStack, { RootStackParamList } from './src/navigation/RootStack';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors, type } from './src/theme';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['beautybook://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      VerifyEmail: 'verify-email',
    },
  },
};

function LogoutRedirect() {
  const { isLoggedIn } = useAuth();
  const wasLoggedIn = useRef(isLoggedIn);

  useEffect(() => {
    if (wasLoggedIn.current && !isLoggedIn && navigationRef.isReady()) {
      navigationRef.resetRoot({ index: 0, routes: [{ name: 'Login' }] });
    }
    wasLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  return null;
}

function AppNavigation() {
  const { isRestoring, user } = useAuth();
  const [routeName, setRouteName] = useState<string>();
  // Screens whose top edge is a brand gradient or a photo need light status-bar icons.
  const darkHeader = BRAND_TOP_ROUTES.includes(routeName || '');
  if (isRestoring) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.restoring}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.restoringText}>Đang khôi phục phiên đăng nhập...</Text>
        </View>
      </>
    );
  }
  return (
    <>
      <StatusBar style={darkHeader ? 'light' : 'dark'} />
      <NavigationContainer key={user && ['SALON', 'PLATFORM'].includes(user.workspace ?? '') ? JSON.stringify([user.id, user.workspace, user.businessId, user.branchId]) : 'CUSTOMER'} ref={navigationRef} linking={linking} onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name)} onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}>
        <RootStack />
      </NavigationContainer>
      <LogoutRedirect />
    </>
  );
}

const BRAND_TOP_ROUTES = [
  'Login', 'Register', 'ForgotPassword', 'ResetPassword', 'VerifyEmail',
  'HomeMain', 'AccountMain', 'VenueDetail', 'ComboDetail', 'BookingSuccess', 'HoatDongMain',
  // Staff / Owner tab roots sit under the plum operations header.
  'WorkList', 'Tài khoản', 'TongQuan', 'VanHanh', 'ThongBao', 'TaiKhoan', 'UnsupportedWorkspace',
];

export default function App() {
  // Brand typefaces. If loading fails the app still opens with the system font.
  const [fontsLoaded, fontError] = useFonts({ BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold, Fraunces_600SemiBold });
  if (!fontsLoaded && !fontError) {
    return <View style={styles.restoring}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  restoring: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.background,
  },
  restoringText: { ...type.secondary },
});
