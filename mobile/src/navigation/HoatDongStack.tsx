import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LichHenScreen from '../screens/LichHenScreen';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import AppointmentCalendarScreen from '../screens/AppointmentCalendarScreen';
import RescheduleScreen from '../screens/RescheduleScreen';

export type AppointmentStatusParam = 'upcoming' | 'completed' | 'cancelled';

export type HoatDongStackParamList = {
  HoatDongMain: undefined;
  AppointmentDetail: {
    id: string;
    isReal: boolean;
    shopName: string;
    address: string;
    title: string;
    staffName: string;
    imageUri: string;
    date: string;
    time: string;
    price: number;
    status: AppointmentStatusParam;
    comboId?: string;
  };
  CalendarView: undefined;
  Reschedule: { bookingId: string };
};

const Stack = createNativeStackNavigator<HoatDongStackParamList>();

export default function HoatDongStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HoatDongMain" component={LichHenScreen} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <Stack.Screen name="CalendarView" component={AppointmentCalendarScreen} />
      <Stack.Screen name="Reschedule" component={RescheduleScreen} />
    </Stack.Navigator>
  );
}
