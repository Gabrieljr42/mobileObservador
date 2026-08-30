import axios from 'axios';
import { getStoredToken } from '../storage/auth';
import { Concurso } from '../types/concurso';
import { localConcursos } from '../db/repositories';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.observador.tech';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  response => response,
  error => Promise.reject(error),
);

export const fetchConcursos = async (): Promise<Concurso[]> => localConcursos.all();

export const fetchConcursoById = async (id: number): Promise<Concurso> => {
  const concurso = await localConcursos.byId(id);
  if (!concurso) {
    throw new Error('Concurso ainda não existe no banco local. Faça uma sincronização quando o servidor estiver disponível.');
  }
  return concurso;
};

// Kept for compatibility with the existing screens; real data only comes from SQLite.
export const getDemoConcursos = (): Concurso[] => [];

export const getDemoConcursoById = (_id: number): Concurso => {
  throw new Error('Dados de demonstração desativados.');
};
