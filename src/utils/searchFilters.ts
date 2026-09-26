import type { Concurso } from '../types/concurso';

const normalize = (value?: string | null) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/** Keeps the legacy cargo text searchable alongside every structured cargo. */
export const concursoCargoNames = (concurso: Pick<Concurso, 'cargo' | 'cargos'>): string[] => (
  Array.from(new Set([
    concurso.cargo,
    ...(concurso.cargos ?? []).map(cargo => cargo.nome),
  ].map(value => value?.trim()).filter(Boolean) as string[]))
);

export const matchesCargo = (concurso: Pick<Concurso, 'cargo' | 'cargos'>, query?: string | null) => {
  const term = normalize(query);
  return !term || concursoCargoNames(concurso).some(name => normalize(name).includes(term));
};
