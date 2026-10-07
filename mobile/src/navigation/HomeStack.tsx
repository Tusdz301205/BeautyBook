import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ComboDetailScreen from '../screens/ComboDetailScreen';
import VenueDetailScreen from '../screens/VenueDetailScreen';
import BookingScreen from '../screens/BookingScreen';
import AddServiceScreen from '../screens/AddServiceScreen';
import BookingSuccessScreen from '../screens/BookingSuccessScreen';

export interface BookingServiceLine {
  id: string;
  name: string;
  duration: string;
  price: number;
  quantity: number;
}

export type HomeStackParamList = {
  HomeMain: undefined;
  ComboDetail: { comboId: string };
  VenueDetail: { venueId: string; serviceId?: string; serviceIds?: string[]; rebooking?: boolean };
  Booking: {
    branchId: string;
    shopName: string;
    addresses: string[];
    service: { id: string; name: string; duration: string; price: number; originalPrice: number };
    serviceIds: string[];
    comboId?: string;
    staffOptions?: Array<{ id: string; name: string }>;
  };
  AddService: {
    branchId: string;
    shopName: string;
    selected: Record<string, number>;
    onConfirm: (services: BookingServiceLine[]) => void;
  };
  BookingSuccess: { bookingId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="ComboDetail" component={ComboDetailScreen} />
      <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="AddService" component={AddServiceScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
    </Stack.Navigator>
  );
}
