import { apiRequest, withQuery } from './client';

export interface ApiNotification {
  id: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
  relatedBooking?: { id: string } | null;
}

export interface ApiNotificationsPage {
  data: ApiNotification[];
  pagination: { page: number; totalPages: number; total: number };
  unreadCount: number;
}

export const notificationsApi = {
  list: (page = 1) => apiRequest<ApiNotificationsPage>(withQuery('/notifications', { page, limit: 20 })),
  markRead: (id: string) => apiRequest<unknown>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  markAllRead: () => apiRequest<unknown>('/notifications/read-all', { method: 'PATCH' }),
};
