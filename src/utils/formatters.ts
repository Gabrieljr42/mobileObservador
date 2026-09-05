const DATE_PART_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}(?:T|\s)\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b|\b\d{4}-\d{2}-\d{2}\b/g;

/**
 * Formats API dates without exposing the ISO representation to users.
 * Calendar dates keep the date supplied by the API so a midnight UTC value
 * does not unexpectedly become the previous day in Brazil.
 */
export function formatDate(value?: string | null): string {
  if (!value) return 'Data não informada';

  const rawValue = String(value).trim();
  const datePart = rawValue.match(DATE_PART_PATTERN);
  if (datePart) {
    return `${datePart[3]}/${datePart[2]}/${datePart[1]}`;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return rawValue;
  return parsed.toLocaleDateString('pt-BR');
}

/** Replaces ISO date/datetime fragments inside summaries and descriptions. */
export function formatDatesInText(value?: string | null): string {
  if (!value) return '';
  return value.replace(ISO_DATE_PATTERN, match => formatDate(match));
}
