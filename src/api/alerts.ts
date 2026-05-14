import { apiClient } from './client';

export const getAlerts = async () => {
  const response = await apiClient.get('/me/alerts');
  return response.data;
};

export const createAlert = async (alert: any) => {
  const response = await apiClient.post('/me/alerts', alert);
  return response.data;
};

export const updateAlert = async (alertId: number, data: any) => {
  const response = await apiClient.patch(`/me/alerts/${alertId}`, data);
  return response.data;
};

export const deleteAlert = async (alertId: number) => {
  const response = await apiClient.delete(`/me/alerts/${alertId}`);
  return response.data;
};

export const runAlertsSync = async () => {
  const response = await apiClient.post('/me/alerts/run/sync');
  return response.data;
};
