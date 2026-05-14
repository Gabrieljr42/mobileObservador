import { apiClient } from './client';

export const getPreferences = async () => {
  const response = await apiClient.get('/me/preferences');
  return response.data;
};

export const updatePreferences = async (preferences: any) => {
  const response = await apiClient.put('/me/preferences', preferences);
  return response.data;
};
