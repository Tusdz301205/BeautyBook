import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { colors } from '../constants/colors';

export const TAB_BAR_CLEARANCE = 100;

const HIDDEN_ROUTES = [
  'ComboDetail',
  'VenueDetail',
  'Booking',
  'AddService',
  'BookingSuccess',
  'AppointmentDetail',
  'CalendarView',
  'Favorites',
  'Messages',
  'Profile',
  'Forms',
  'Settings',
  'Support',
  'AddressForm',
  'ChangePassword',
];

const TAB_CONFIG: Record<string, { label: string; active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  DiaDiem: { label: 'Khám phá', active: 'compass', inactive: 'compass-outline' },
  TimKiem: { label: 'Tìm kiếm', active: 'search', inactive: 'search-outline' },
  LichHen: { label: 'Lịch hẹn', active: 'calendar', inactive: 'calendar-outline' },
  TaiKhoan: { label: 'Tài khoản', active: 'person', inactive: 'person-outline' },
};

export default function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const focusedRoute = state.routes[state.index];
  const nestedRouteName = getFocusedRouteNameFromRoute(focusedRoute);

  if (nestedRouteName && HIDDEN_ROUTES.includes(nestedRouteName)) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={config.label} accessibilityState={{ selected: isFocused }} style={styles.tabButton} onPress={onPress}>
            <Ionicons
              name={isFocused ? config.active : config.inactive}
              size={22}
              color={isFocused ? colors.primary : colors.textGray}
            />
            <Text style={[styles.label, { color: isFocused ? colors.primary : colors.textGray }]}>
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 8,
    minHeight: 64,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
