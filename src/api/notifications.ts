import { apiClient } from './client';

export const getNotifications = async (unreadOnly = false) => {
  const response = await apiClient.get(`/me/notifications?unread_only=${unreadOnly}`);
  return response.data;
};

export const markNotificationAsRead = async (notificationId: number) => {
  const response = await apiClient.post(`/me/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await apiClient.post('/me/notifications/read-all');
  return response.data;
};
