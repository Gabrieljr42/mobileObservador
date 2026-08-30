import { apiClient } from './client';

export type ConcursoPublication = {
  id: number;
  concurso_id: number;
  title: string;
  publication_type: string;
  publication_date?: string | null;
  link?: string | null;
  content_hash?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const getConcursoPublications = async (concursoId: number): Promise<ConcursoPublication[]> => {
  const response = await apiClient.get(`/concursos/${concursoId}/publications`);
  return response.data;
};
