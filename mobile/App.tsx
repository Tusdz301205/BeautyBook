import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootStack, { RootStackParamList } from './src/navigation/RootStack';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/constants/colors';

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
  const { isRestoring, isLoggedIn, user } = useAuth();
  const [routeName, setRouteName] = useState<string>();
  const authRoutes = ['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'VerifyEmail', 'OtpVerify'];
  const authHeader = authRoutes.includes(routeName || '');
  const darkHeader = authHeader || routeName === 'Booking' || routeName === 'AppointmentDetail' || (routeName === 'AccountMain' && !isLoggedIn);
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

export default function App() {
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
  restoringText: { color: colors.textGray, fontSize: 15 },
});
