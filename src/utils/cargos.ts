import { CargoDetalhado } from '../types/concurso';

const numericString = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) return value.trim();
  return null;
};

const finiteInteger = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(number) && Number.isFinite(number) && number >= 0 ? number : null;
};

/** Maps reviewed/legacy cargo aliases at the mobile boundary without source-specific assumptions. */
export const normalizarCargo = (value: unknown, concursoTaxa?: unknown): CargoDetalhado | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const nome = typeof raw.nome === 'string' && raw.nome.trim()
    ? raw.nome.trim()
    : typeof raw.cargo === 'string' && raw.cargo.trim() ? raw.cargo.trim() : null;
  if (!nome) return null;
  const immediate = finiteInteger(raw.vagas_imediatas ?? raw.vagas ?? raw.vagas_total);
  const requirements = typeof raw.requisitos === 'string' && raw.requisitos.trim()
    ? raw.requisitos.trim()
    : typeof raw.requisito === 'string' && raw.requisito.trim() ? raw.requisito.trim() : 'Requisitos ainda não confirmados';
  const fee = numericString(raw.taxa_inscricao ?? concursoTaxa);
  return {
    ...raw,
    nome,
    codigo: typeof raw.codigo === 'string' || typeof raw.codigo === 'number' ? raw.codigo : null,
    vagas: raw.vagas as CargoDetalhado['vagas'],
    vagas_imediatas: immediate,
    cadastro_reserva: typeof raw.cadastro_reserva === 'boolean' ? raw.cadastro_reserva : null,
    remuneracao: numericString(raw.remuneracao) || (typeof raw.remuneracao === 'string' ? raw.remuneracao : ''),
    moeda: typeof raw.moeda === 'string' && raw.moeda.trim() ? raw.moeda : 'BRL',
    jornada: typeof raw.jornada === 'string' && raw.jornada.trim() ? raw.jornada : null,
    requisitos: requirements,
    taxa_inscricao: fee,
  } as CargoDetalhado;
};

/** Returns only human-readable benefit labels from the current and legacy payloads. */
export const beneficiosCargo = (cargo: Pick<CargoDetalhado, 'beneficios'> | null | undefined): string[] => {
  if (!cargo || !Array.isArray(cargo.beneficios)) return [];
  return cargo.beneficios.filter((beneficio): beneficio is string => (
    typeof beneficio === 'string' && beneficio.trim().length > 0
  )).map(beneficio => beneficio.trim());
};

/** Immediate quota categories only; cadastro de reserva stays separate. */
export const cotasCargo = (cargo: Pick<CargoDetalhado,
  'vagas_ampla_concorrencia' | 'vagas_pcd' | 'vagas_ppp' | 'vagas_indigenas' | 'vagas_quilombolas' | 'vagas_trans'
>): Array<[string, number]> => {
  const categories: Array<[string, number | undefined]> = [
  ['Ampla concorrência', cargo.vagas_ampla_concorrencia],
  ['PcD', cargo.vagas_pcd],
  ['PPP', cargo.vagas_ppp],
  ['Indígenas', cargo.vagas_indigenas],
  ['Quilombolas', cargo.vagas_quilombolas],
  ['Trans', cargo.vagas_trans],
  ];
  return categories.filter((entry): entry is [string, number] => (
    typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0
  ));
};

export const dinheiroCargo = (valor: string | null | undefined, moeda = 'BRL') => {
  if (typeof valor !== 'string' || !/^\d+(?:\.\d+)?$/.test(valor.trim()) || !Number.isFinite(Number(valor))) {
    return 'valor ainda não confirmado';
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(Number(valor));
};

export const vagasImediatasCargo = (cargo: Pick<CargoDetalhado, 'vagas_imediatas'> | null | undefined): number | null => {
  const value = cargo?.vagas_imediatas;
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0 ? value : null;
};

export const textoVagasImediatas = (cargo: Pick<CargoDetalhado, 'vagas_imediatas'> | null | undefined): string => {
  const value = vagasImediatasCargo(cargo);
  return value == null ? 'Quantidade de vagas imediatas: ainda não confirmada' : `${value} vaga(s) imediata(s)`;
};

export const resumoCargo = (cargo: CargoDetalhado) => {
  const observation = typeof cargo.cadastro_reserva_observacao === 'string'
    ? cargo.cadastro_reserva_observacao.trim()
    : '';
  const quotas = cotasCargo(cargo)
    .map(([label, value]) => `${label}: ${value}`).join('; ');
  const examDate = cargo.prova_data?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return [
  `${cargo.codigo != null && String(cargo.codigo).trim() ? `${cargo.codigo} — ` : ''}${cargo.nome}`,
  `${textoVagasImediatas(cargo)}${typeof cargo.vagas_cadastro_reserva === 'number' && Number.isFinite(cargo.vagas_cadastro_reserva)
    ? ` + ${cargo.vagas_cadastro_reserva} vaga(s) de cadastro de reserva`
    : cargo.cadastro_reserva ? ' + cadastro de reserva' : ''}`,
  ...(observation ? [`Observação do cadastro de reserva: ${observation}`] : []),
  ...(quotas ? [`Distribuição das vagas imediatas: ${quotas}`] : []),
  ...(cargo.vagas_cadastro_reserva == null && cargo.cadastro_reserva == null && !observation
    ? ['Cadastro de reserva: ainda não confirmado']
    : []),
  `Remuneração: ${dinheiroCargo(cargo.remuneracao, cargo.moeda)}`,
  ...(cargo.remuneracao_observacao ? [cargo.remuneracao_observacao] : []),
  `Jornada: ${cargo.jornada ?? 'ainda não confirmada'}`,
  `Requisitos: ${cargo.requisitos}`,
  `Taxa de inscrição: ${dinheiroCargo(cargo.taxa_inscricao, cargo.moeda)}`,
  ...(examDate ? [`Prova: ${examDate[3]}/${examDate[2]}/${examDate[1]}${cargo.prova_inicio ? ` às ${cargo.prova_inicio}` : ''}${cargo.prova_horario_observacao ? ` — ${cargo.prova_horario_observacao}` : ''}`] : []),
  ].join('\n');
};
