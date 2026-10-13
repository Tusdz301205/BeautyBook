import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOperations } from '../OperationsContext';
import OperationsAccount from '../OperationsAccount';
import OperationsNotifications from '../OperationsNotifications';
import { stackScreenOptions } from '../stackOptions';
import { BrandTabBar, type TabConfig } from '../../ui';
import OwnerOverview from './OwnerOverview';
import OwnerOperations from './OwnerOperations';
import { OwnerBookingDetail, OwnerImpactDetail, OwnerRequestDetail } from './OwnerDetails';

export type OwnerTabParams = { TongQuan: undefined; VanHanh: undefined; ThongBao: undefined; TaiKhoan: undefined };
export type OwnerStackParams = {
  OwnerHome: NavigatorScreenParams<OwnerTabParams> | undefined;
  OwnerRequest: { id: string; fromNotification?: true };
  OwnerImpact: { id: string; fromNotification?: true };
  OwnerBooking: { id: string; fromNotification?: true };
};
const Tab = createBottomTabNavigator<OwnerTabParams>(), Stack = createNativeStackNavigator<OwnerStackParams>();
function Notifications() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParams>>();
  return <OperationsNotifications onOpenBooking={id => navigation.navigate('OwnerBooking', { id, fromNotification: true })} onOpenImpact={id => navigation.navigate('OwnerImpact', { id, fromNotification: true })} />;
}
const TABS: TabConfig = {
  TongQuan: { label: 'Tổng quan', icon: 'grid-outline', activeIcon: 'grid' },
  VanHanh: { label: 'Vận hành', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  ThongBao: { label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications' },
  TaiKhoan: { label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
};
function Tabs() {
  return <Tab.Navigator initialRouteName="TongQuan" screenOptions={{ headerShown: false }} tabBar={props => <BrandTabBar {...props} config={TABS} />}>
    <Tab.Screen name="TongQuan" component={OwnerOverview} options={{ title: 'Tổng quan' }} />
    <Tab.Screen name="VanHanh" component={OwnerOperations} options={{ title: 'Vận hành' }} />
    <Tab.Screen name="ThongBao" component={Notifications} options={{ title: 'Thông báo' }} />
    <Tab.Screen name="TaiKhoan" component={OperationsAccount} options={{ title: 'Tài khoản' }} />
  </Tab.Navigator>;
}
export default function OwnerTabs() {
  const operations = useOperations();
  // Branch/mode/session changes remove old details, confirmation and review notes.
  return <Stack.Navigator key={`${operations.contextKey}:${operations.branchId ?? 'all'}`} screenOptions={stackScreenOptions}>
    <Stack.Screen name="OwnerHome" component={Tabs} options={{ headerShown: false }} />
    <Stack.Screen name="OwnerRequest" component={OwnerRequestDetail} options={{ title: 'Xét duyệt yêu cầu' }} />
    <Stack.Screen name="OwnerImpact" component={OwnerImpactDetail} options={{ title: 'Ảnh hưởng vận hành' }} />
    <Stack.Screen name="OwnerBooking" component={OwnerBookingDetail} options={{ title: 'Chi tiết lịch hẹn' }} />
  </Stack.Navigator>;
}
