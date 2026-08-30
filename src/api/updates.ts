import { localUpdates, localVersions } from '../db/repositories';

export type ConcursoUpdate = {
  id: number;
  concurso_id: number;
  titulo: string;
  banca?: string | null;
  cidade?: string | null;
  uf?: string | null;
  area?: string | null;
  status?: string | null;
  change_type: string;
  change_summary: string;
  captured_at: string;
};

export type ConcursoVersion = {
  id: number;
  concurso_id: number;
  content_hash: string;
  change_type: string;
  changed_fields?: Record<string, unknown> | null;
  change_summary?: string | null;
  raw_data_snapshot?: Record<string, unknown> | null;
  captured_at: string;
};

export const getRecentUpdates = async (limit = 20): Promise<ConcursoUpdate[]> => localUpdates.recent(limit);
export const getMyUpdates = async (limit = 20): Promise<ConcursoUpdate[]> => localUpdates.mine(limit);
export const getConcursoVersions = async (concursoId: number): Promise<ConcursoVersion[]> => localVersions.byConcurso(concursoId);
