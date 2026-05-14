import axios from 'axios';
import { Platform } from 'react-native';
import { getStoredToken, clearToken } from '../storage/auth';
import { router } from 'expo-router';
import { Concurso } from '../types/concurso';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:8000";

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
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await clearToken();
      // Only redirect if not already on auth screens (to prevent loops)
      // Since router might not be available in simple API call, preferably just clear token. The AuthProvider should handle the state.
      // But we can trigger an event or just do router.replace('/login') for safety if needed.
    }
    return Promise.reject(error);
  }
);

export const fetchConcursos = async (): Promise<Concurso[]> => {
  try {
    const response = await apiClient.get('/concursos');
    return response.data;
  } catch (error) {
    throw new Error('Falha ao conectar com o servidor. Verifique se a API está rodando.');
  }
};

export const fetchConcursoById = async (id: number): Promise<Concurso> => {
  try {
    const response = await apiClient.get(`/concursos/${id}`);
    return response.data;
  } catch (error) {
    throw new Error('Falha ao carregar detalhes do concurso.');
  }
};

export const getDemoConcursos = (): Concurso[] => {
  return fallbackConcursos;
};

export const getDemoConcursoById = (id: number): Concurso => {
  const fallback = fallbackConcursos.find(c => c.id === Number(id));
  if (fallback) return fallback;
  throw new Error("Concurso não encontrado localmente.");
};

const fallbackConcursos: Concurso[] = [
  {
    id: 1,
    source_id: 101,
    titulo: 'Assistente Social',
    orgao: 'Prefeitura de Belo Horizonte',
    banca: 'FGV',
    uf: 'MG',
    cidade: 'Belo Horizonte',
    cargo: 'Assistente Social',
    status: 'Inscrições Abertas',
    inscricao_inicio: '2026-09-10',
    inscricao_fim: '2026-10-10',
    edital_data: '2026-11-12',
    resumo: 'Concurso para prefeitura de BH',
  },
  {
    id: 2,
    source_id: 102,
    titulo: 'Analista Judiciário - Assistente Social',
    orgao: 'Tribunal de Justiça (MG)',
    banca: 'FGV',
    uf: 'MG',
    cargo: 'Analista',
    status: 'Em Breve',
    resumo: 'Oportunidade para analista com especialização',
  }
];
