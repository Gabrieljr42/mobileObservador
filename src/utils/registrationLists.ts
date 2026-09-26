/** Format only the structured registration lists returned with document evidence. */
export function registrationListsText(value: unknown): string | null {
  if (!Array.isArray(value) || !value.length || !value.every(v => v &&
    typeof v.lista === 'string' && typeof v.inicio === 'string' &&
    (typeof v.fim === 'string' || (v.fim === null && typeof v.condicao_fim === 'string')))) return null;
  const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v;
  return value.map(v => `${v.lista.charAt(0).toUpperCase()}${v.lista.slice(1)} lista: início em ${date(v.inicio)}; ${v.fim ? `fim em ${date(v.fim)}` : v.condicao_fim}.`).join('\n');
}
