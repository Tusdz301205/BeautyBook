import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useOperations } from '../OperationsContext';
import OperationsAccount from '../OperationsAccount';
import OperationsNotifications from '../OperationsNotifications';
import OperationTabLabel, { useOperationTabHeight } from '../OperationTabLabel';
import OwnerOverview from './OwnerOverview';
import OwnerOperations from './OwnerOperations';
import { OwnerBookingDetail, OwnerImpactDetail, OwnerRequestDetail } from './OwnerDetails';

export type OwnerTabParams = { TongQuan: undefined; VanHanh: undefined; ThongBao: undefined; TaiKhoan: undefined };
export type OwnerStackParams = {
  OwnerHome: NavigatorScreenParams<OwnerTabParams> | undefined;
  OwnerRequest: { id: string };
  OwnerImpact: { id: string };
  OwnerBooking: { id: string };
};
const Tab = createBottomTabNavigator<OwnerTabParams>(), Stack = createNativeStackNavigator<OwnerStackParams>();
function Notifications() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParams>>();
  return <OperationsNotifications onOpenBooking={id => navigation.navigate('OwnerBooking', { id })} onOpenImpact={id => navigation.navigate('OwnerImpact', { id })} />;
}
function Tabs() {
  const tabHeight = useOperationTabHeight();
  const icons: Record<keyof OwnerTabParams, React.ComponentProps<typeof Ionicons>['name']> = { TongQuan: 'grid-outline', VanHanh: 'clipboard-outline', ThongBao: 'notifications-outline', TaiKhoan: 'person-outline' };
  const titles = { TongQuan: 'Tổng quan', VanHanh: 'Vận hành', ThongBao: 'Thông báo', TaiKhoan: 'Tài khoản' };
  return <Tab.Navigator initialRouteName="TongQuan" screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textGray, tabBarStyle: { backgroundColor: colors.card, height: tabHeight }, tabBarLabel: ({ color }) => <OperationTabLabel title={titles[route.name]} color={color} />, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} size={size} color={color} /> })}>
    <Tab.Screen name="TongQuan" component={OwnerOverview} options={{ title: 'Tổng quan' }} />
    <Tab.Screen name="VanHanh" component={OwnerOperations} options={{ title: 'Vận hành' }} />
    <Tab.Screen name="ThongBao" component={Notifications} options={{ title: 'Thông báo' }} />
    <Tab.Screen name="TaiKhoan" component={OperationsAccount} options={{ title: 'Tài khoản' }} />
  </Tab.Navigator>;
}
export default function OwnerTabs() {
  const operations = useOperations();
  // Branch/mode/session changes remove old details, confirmation and review notes.
  return <Stack.Navigator key={`${operations.contextKey}:${operations.branchId ?? 'all'}`} screenOptions={{ headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="OwnerHome" component={Tabs} options={{ headerShown: false }} />
    <Stack.Screen name="OwnerRequest" component={OwnerRequestDetail} options={{ title: 'Xét duyệt yêu cầu' }} />
    <Stack.Screen name="OwnerImpact" component={OwnerImpactDetail} options={{ title: 'Ảnh hưởng vận hành' }} />
    <Stack.Screen name="OwnerBooking" component={OwnerBookingDetail} options={{ title: 'Chi tiết lịch hẹn' }} />
  </Stack.Navigator>;
}
