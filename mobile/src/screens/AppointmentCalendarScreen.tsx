import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { RootTabParamList } from '../navigation/RootTabs';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors, layout, space, type } from '../theme';
import { ScreenHeader } from '../ui';
import { useAppointments } from '../hooks/useAppointments';
import { Appointment, apptTimestamp, formatGroupHeader, parseApptDate } from '../data/appointments';
import AppointmentCalendar, { DayMark, dateKey } from '../components/AppointmentCalendar';
import AppointmentCard from '../components/AppointmentCard';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HoatDongStackParamList, 'CalendarView'>,
  BottomTabScreenProps<RootTabParamList>
>;

export default function AppointmentCalendarScreen({ navigation }: Props) {
  const appointments = useAppointments();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKey(new Date()));

  const marks = useMemo(() => {
    const map: Record<string, DayMark> = {};
    appointments.forEach((item) => {
      const key = dateKey(parseApptDate(item.date));
      const existing = map[key] ?? { hasUpcoming: false, hasCompleted: false, hasCancelled: false };
      if (item.status === 'upcoming') existing.hasUpcoming = true;
      if (item.status === 'completed') existing.hasCompleted = true;
      if (item.status === 'cancelled') existing.hasCancelled = true;
      map[key] = existing;
    });
    return map;
  }, [appointments]);

  const selectedAppointments = useMemo(
    () =>
      appointments
        .filter((item) => dateKey(parseApptDate(item.date)) === selectedDateKey)
        .sort((a, b) => apptTimestamp(a) - apptTimestamp(b)),
    [appointments, selectedDateKey]
  );

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);

  const navigateToDetail = (item: Appointment) =>
    navigation.navigate('AppointmentDetail', {
      id: item.id,
      isReal: item.isReal,
      shopName: item.shopName,
      address: item.address,
      title: item.comboTitle,
      staffName: item.staffName,
      imageUri: item.imageUri,
      date: item.date,
      time: item.time,
      price: item.price,
      status: item.status,
      comboId: item.comboId,
    });

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Lịch hẹn theo tháng" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppointmentCalendar visibleMonth={visibleMonth} onChangeMonth={setVisibleMonth} selectedDateKey={selectedDateKey} onSelectDate={setSelectedDateKey} marks={marks} />
        <View style={styles.agendaHeader}>
          <Text accessibilityRole="header" style={styles.agendaTitle}>{formatGroupHeader(selectedDate)}</Text>
          {selectedAppointments.length > 0 && <Text style={styles.agendaCount}>{selectedAppointments.length} lịch hẹn</Text>}
        </View>
        {selectedAppointments.length === 0 ? (
          <View style={styles.agendaEmpty}>
            <Ionicons accessible={false} name="calendar-clear-outline" size={28} color={colors.secondaryText} />
            <Text style={styles.agendaEmptyText}>Không có lịch hẹn vào ngày này</Text>
          </View>
        ) : selectedAppointments.map((item) => {
          const comboId = item.comboId;
          return (
            <AppointmentCard
              key={item.id}
              item={item}
              onPress={() => navigateToDetail(item)}
              onRebook={item.status === 'completed' && comboId ? () => navigation.navigate('DiaDiem', { screen: 'ComboDetail', params: { comboId } }) : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: TAB_BAR_CLEARANCE + space.lg },
  agendaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.md },
  agendaTitle: { ...type.h3 },
  agendaCount: { ...type.secondary },
  agendaEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.huge, gap: space.sm },
  agendaEmptyText: { ...type.secondary },
});
