import { localNotifications } from '../db/repositories';

export const getNotifications = async (unreadOnly = false) => localNotifications.all(unreadOnly);
export const markNotificationAsRead = async (notificationId: number) => localNotifications.markRead(notificationId);
export const markAllNotificationsAsRead = async () => localNotifications.markAllRead();
