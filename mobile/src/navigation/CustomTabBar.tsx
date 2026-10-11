import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BrandTabBar, type TabConfig } from '../ui';

/** The tab bar is laid out in flow (not absolute), so screens only need a small end gap. */
export const TAB_BAR_CLEARANCE = 24;

const HIDDEN_ROUTES = [
  'ComboDetail',
  'VenueDetail',
  'Booking',
  'AddService',
  'BookingSuccess',
  'AppointmentDetail',
  'CalendarView',
  'Reschedule',
  'Favorites',
  'Messages',
  'Profile',
  'Settings',
  'Support',
  'AddressForm',
  'ChangePassword',
];

const TAB_CONFIG: TabConfig = {
  DiaDiem: { label: 'Khám phá', icon: 'compass-outline', activeIcon: 'compass' },
  TimKiem: { label: 'Tìm kiếm', icon: 'search-outline', activeIcon: 'search' },
  LichHen: { label: 'Lịch hẹn', icon: 'calendar-outline', activeIcon: 'calendar' },
  TaiKhoan: { label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
};

export default function CustomTabBar(props: BottomTabBarProps) {
  return <BrandTabBar {...props} config={TAB_CONFIG} hiddenRoutes={HIDDEN_ROUTES} />;
}
