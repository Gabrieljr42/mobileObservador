import { Concurso } from '../types/concurso';
import { localFavorites } from '../db/repositories';

export const getFavorites = async (): Promise<Concurso[]> => localFavorites.all();
export const addFavorite = async (concursoId: number) => localFavorites.add(concursoId);
export const removeFavorite = async (concursoId: number) => localFavorites.remove(concursoId);
