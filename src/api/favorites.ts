import { apiClient } from './client';
import { Concurso } from '../types/concurso';

export const getFavorites = async (): Promise<Concurso[]> => {
  const response = await apiClient.get('/me/favorites');
  return response.data;
};

export const addFavorite = async (concursoId: number) => {
  const response = await apiClient.post(`/me/favorites/${concursoId}`);
  return response.data;
};

export const removeFavorite = async (concursoId: number) => {
  const response = await apiClient.delete(`/me/favorites/${concursoId}`);
  return response.data;
};
