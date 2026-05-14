import AsyncStorage from '@react-native-async-storage/async-storage';
import { Concurso } from '../types/concurso';

const FAVORITES_KEY = '@concursos_favorites';

export const getFavorites = async (): Promise<Concurso[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(FAVORITES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Error reading favorites', e);
    return [];
  }
};

export const storeFavorite = async (concurso: Concurso) => {
  try {
    const favorites = await getFavorites();
    const alreadyExists = favorites.some((fav) => fav.id === concurso.id);
    if (!alreadyExists) {
      favorites.push(concurso);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  } catch (e) {
    console.error('Error storing favorite', e);
  }
};

export const removeFavorite = async (id: number) => {
  try {
    const favorites = await getFavorites();
    const filtered = favorites.filter((fav) => fav.id !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error removing favorite', e);
  }
};

export const isFavorite = async (id: number): Promise<boolean> => {
  const favorites = await getFavorites();
  return favorites.some((fav) => fav.id === id);
};
