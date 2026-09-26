export type CargoDetalhado = {
  nome: string;
  codigo?: string | number | null;
  /** Legacy/source alias accepted at the local API boundary. */
  vagas?: number | string | null;
  vagas_imediatas?: number | null;
  cadastro_reserva: boolean | null;
  vagas_cadastro_reserva?: number | null;
  cadastro_reserva_observacao?: string | null;
  remuneracao: string;
  remuneracao_observacao?: string | null;
  vagas_ampla_concorrencia?: number;
  vagas_pcd?: number;
  vagas_ppp?: number;
  vagas_indigenas?: number;
  vagas_quilombolas?: number;
  vagas_trans?: number;
  prova_data?: string | null;
  prova_inicio?: string | null;
  prova_horario_observacao?: string | null;
  moeda: string;
  jornada: string | null;
  requisitos: string;
  taxa_inscricao: string | null;
  beneficios?: string[] | null;
};

export type Concurso = {
  id: number;
  source_id: number;
  external_id?: string | null;
  banca?: string | null;
  orgao?: string | null;
  titulo: string;
  modalidade?: string | null;
  cargo?: string | null;
  cargos?: CargoDetalhado[] | null;
  prova_data?: string | null;
  area?: string | null;
  cidade?: string | null;
  uf?: string | null;
  status?: string | null;
  edital_numero?: string | null;
  edital_data?: string | null;
  inscricao_inicio?: string | null;
  inscricao_fim?: string | null;
  link_pagina?: string | null;
  link_edital?: string | null;
  link_inscricao?: string | null;
  resumo?: string | null;
  raw_data?: Record<string, unknown> | null;
  taxa_inscricao?: string | number | null;
  /** Canonical API proposal field; retained as an alias at the mobile boundary. */
  taxa?: string | number | null;
  content_hash?: string | null;
  fetched_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ConcursoReviewStatus = {
  pending: boolean;
  unavailable?: boolean;
  documents?: Array<Record<string, unknown>>;
  reason?: string;
  evidence?: string;
  candidate_key?: string;
  last_run_id?: string | null;
};
