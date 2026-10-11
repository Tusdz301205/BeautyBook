import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import OperationsAccount from '../OperationsAccount';
import OperationsNotifications from '../OperationsNotifications';
import { stackScreenOptions } from '../stackOptions';
import { BrandTabBar, type TabConfig } from '../../ui';
import { StaffListScreen, StaffDetailScreen, type StaffWorkStackParams, type WorkScreenProps } from './StaffWorkScreen';

type StaffTabParams = { 'Hôm nay': undefined; 'Lịch': undefined; 'Thông báo': undefined; 'Tài khoản': undefined };
const Tab = createBottomTabNavigator<StaffTabParams>();
const Stack = createNativeStackNavigator<StaffWorkStackParams>();
const TABS: TabConfig = {
  'Hôm nay': { label: 'Hôm nay', icon: 'today-outline', activeIcon: 'today' },
  'Lịch': { label: 'Lịch', icon: 'calendar-outline', activeIcon: 'calendar' },
  'Thông báo': { label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications' },
  'Tài khoản': { label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
};
function Today(props: WorkScreenProps) { return <StaffListScreen {...props} />; }
function Agenda(props: WorkScreenProps) { return <StaffListScreen {...props} agenda />; }
function BookingWork({ route, navigation }: NativeStackScreenProps<StaffWorkStackParams, 'BookingWork'>) {
  return <StaffListScreen navigation={navigation} bookingId={route.params.bookingId} />;
}
function WorkStack({ agenda = false }: { agenda?: boolean }) {
  return <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="WorkList" component={agenda ? Agenda : Today} options={{ headerShown: false }} />
    <Stack.Screen name="WorkDetail" component={StaffDetailScreen} options={{ title: 'Chi tiết công việc' }} />
    <Stack.Screen name="BookingWork" component={BookingWork} options={{ title: 'Dịch vụ trong lịch hẹn' }} />
  </Stack.Navigator>;
}
function TodayStack() { return <WorkStack />; }
function AgendaStack() { return <WorkStack agenda />; }
function NotificationList({ navigation }: WorkScreenProps) {
  return <OperationsNotifications onOpenBooking={bookingId => navigation.navigate('BookingWork', { bookingId })} />;
}
function NotificationStack() {
  return <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="WorkList" component={NotificationList} options={{ headerShown: false }} />
    <Stack.Screen name="BookingWork" component={BookingWork} options={{ title: 'Dịch vụ trong lịch hẹn' }} />
    <Stack.Screen name="WorkDetail" component={StaffDetailScreen} options={{ title: 'Chi tiết công việc' }} />
  </Stack.Navigator>;
}
export default function StaffTabs() {
  return <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={props => <BrandTabBar {...props} config={TABS} />}>
    <Tab.Screen name="Hôm nay" component={TodayStack} />
    <Tab.Screen name="Lịch" component={AgendaStack} />
    <Tab.Screen name="Thông báo" component={NotificationStack} />
    <Tab.Screen name="Tài khoản" component={OperationsAccount} />
  </Tab.Navigator>;
}
