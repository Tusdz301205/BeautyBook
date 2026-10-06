import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';
import HomeStack, { HomeStackParamList } from './HomeStack';
import SearchScreen from '../screens/SearchScreen';
import AccountStack, { AccountStackParamList } from './AccountStack';
import HoatDongStack, { HoatDongStackParamList } from './HoatDongStack';
import CustomTabBar from './CustomTabBar';
import CustomerProviders from '../context/CustomerProviders';

export type RootTabParamList = {
  DiaDiem: NavigatorScreenParams<HomeStackParamList> | undefined;
  TimKiem: { initialQuery?: string; canonicalServiceId?: string } | undefined;
  LichHen: NavigatorScreenParams<HoatDongStackParamList> | undefined;
  TaiKhoan: NavigatorScreenParams<AccountStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  return (
    <CustomerProviders><Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="DiaDiem" component={HomeStack} />
      <Tab.Screen name="TimKiem" component={SearchScreen} />
      <Tab.Screen name="LichHen" component={HoatDongStack} />
      <Tab.Screen name="TaiKhoan" component={AccountStack} />
    </Tab.Navigator></CustomerProviders>
  );
}
