import { useMemo } from 'react';

import { useBookings } from '../context/BookingsContext';
import { Appointment, mapBookingsToAppointments } from '../data/appointments';

export function useAppointments(): Appointment[] {
  const { bookings } = useBookings();
  const realAppointments = useMemo(() => mapBookingsToAppointments(bookings), [bookings]);
  return realAppointments;
}
