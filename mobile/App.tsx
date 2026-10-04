import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootStack, { RootStackParamList } from './src/navigation/RootStack';
import { navigationRef } from './src/navigation/navigationRef';
import { DistrictProvider, useDistrict } from './src/context/DistrictContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TimeFilterProvider, useTimeFilter } from './src/context/TimeFilterContext';
import { FilterProvider, useFilter } from './src/context/FilterContext';
import { BookingsProvider } from './src/context/BookingsContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AddressProvider } from './src/context/AddressContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import DistrictPickerModal from './src/components/home/DistrictPickerModal';
import TimeFilterSheet from './src/components/TimeFilterSheet';
import FilterSheet from './src/components/FilterSheet';
import SelectListSheet from './src/components/SelectListSheet';
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

function RootDistrictPicker() {
  const { isPickerVisible, selectedDistrict, selectDistrict, closePicker } = useDistrict();
  return (
    <DistrictPickerModal
      visible={isPickerVisible}
      selectedDistrict={selectedDistrict}
      onSelect={selectDistrict}
      onClose={closePicker}
    />
  );
}

function RootTimeFilterSheet() {
  const { isTimeSheetVisible, timeFilter, customRange, applyTimeFilter, closeTimeSheet } = useTimeFilter();
  return (
    <TimeFilterSheet
      visible={isTimeSheetVisible}
      selected={timeFilter}
      customRange={customRange}
      onApply={applyTimeFilter}
      onClose={closeTimeSheet}
    />
  );
}

function RootFilterSheet() {
  const { isFilterSheetVisible, resultType, setResultType, closeFilterSheet, applySearchFilters } = useFilter();
  return (
    <FilterSheet
      visible={isFilterSheetVisible}
      resultType={resultType}
      onChangeResultType={setResultType}
      onApply={applySearchFilters}
      onClose={closeFilterSheet}
    />
  );
}

function RootLanguageSheet() {
  const { isLanguageSheetVisible, closeLanguageSheet } = useLanguage();
  return (
    <SelectListSheet
      visible={isLanguageSheetVisible}
      title="Ngôn ngữ"
      options={['Tiếng Việt (Việt Nam)']}
      selectedValue="Tiếng Việt (Việt Nam)"
      onSelect={closeLanguageSheet}
      onClose={closeLanguageSheet}
      columns={1}
    />
  );
}

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
  const { isRestoring, isLoggedIn } = useAuth();
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
      <NavigationContainer ref={navigationRef} linking={linking} onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name)} onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}>
        <RootStack />
      </NavigationContainer>
      <RootDistrictPicker />
      <RootTimeFilterSheet />
      <RootFilterSheet />
      <RootLanguageSheet />
      <LogoutRedirect />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DistrictProvider>
          <TimeFilterProvider>
            <FilterProvider>
              <BookingsProvider>
                <FavoritesProvider>
                  <AddressProvider>
                    <LanguageProvider>
                      <AppNavigation />
                    </LanguageProvider>
                  </AddressProvider>
                </FavoritesProvider>
              </BookingsProvider>
            </FilterProvider>
          </TimeFilterProvider>
        </DistrictProvider>
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
