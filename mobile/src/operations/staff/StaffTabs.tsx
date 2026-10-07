import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import OperationsAccount from '../OperationsAccount';
import OperationsNotifications from '../OperationsNotifications';
import OperationTabLabel, { useOperationTabHeight } from '../OperationTabLabel';
import { StaffListScreen, StaffDetailScreen, type StaffWorkStackParams, type WorkScreenProps } from './StaffWorkScreen';

type StaffTabParams = { 'Hôm nay': undefined; 'Lịch': undefined; 'Thông báo': undefined; 'Tài khoản': undefined };
const Tab = createBottomTabNavigator<StaffTabParams>();
const Stack = createNativeStackNavigator<StaffWorkStackParams>();
function Today(props: WorkScreenProps) { return <StaffListScreen {...props} />; }
function Agenda(props: WorkScreenProps) { return <StaffListScreen {...props} agenda />; }
function BookingWork({ route, navigation }: NativeStackScreenProps<StaffWorkStackParams, 'BookingWork'>) {
  return <StaffListScreen navigation={navigation} bookingId={route.params.bookingId} />;
}
function WorkStack({ agenda = false }: { agenda?: boolean }) {
  return <Stack.Navigator screenOptions={{ headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="WorkList" component={agenda ? Agenda : Today} options={{ headerShown: false }} />
    <Stack.Screen name="WorkDetail" component={StaffDetailScreen} options={{ title: 'Công việc của tôi' }} />
    <Stack.Screen name="BookingWork" component={BookingWork} options={{ title: 'Lịch được phân công' }} />
  </Stack.Navigator>;
}
function TodayStack() { return <WorkStack />; }
function AgendaStack() { return <WorkStack agenda />; }
function NotificationList({ navigation }: WorkScreenProps) {
  return <OperationsNotifications onOpenBooking={bookingId => navigation.navigate('BookingWork', { bookingId })} />;
}
function NotificationStack() {
  return <Stack.Navigator screenOptions={{ headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="WorkList" component={NotificationList} options={{ headerShown: false }} />
    <Stack.Screen name="BookingWork" component={BookingWork} options={{ title: 'Lịch được phân công' }} />
    <Stack.Screen name="WorkDetail" component={StaffDetailScreen} options={{ title: 'Công việc của tôi' }} />
  </Stack.Navigator>;
}
export default function StaffTabs() {
  const tabHeight = useOperationTabHeight();
  return <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textGray, tabBarStyle: { backgroundColor: colors.card, height: tabHeight },
    tabBarLabel: ({ color }) => <OperationTabLabel title={route.name} color={color} />, tabBarIcon: ({ color, size }) => <Ionicons color={color} size={size}
      name={({ 'Hôm nay': 'today-outline', 'Lịch': 'calendar-outline', 'Thông báo': 'notifications-outline', 'Tài khoản': 'person-outline' } as const)[route.name]} />,
  })}>
    <Tab.Screen name="Hôm nay" component={TodayStack} />
    <Tab.Screen name="Lịch" component={AgendaStack} />
    <Tab.Screen name="Thông báo" component={NotificationStack} />
    <Tab.Screen name="Tài khoản" component={OperationsAccount} />
  </Tab.Navigator>;
}
