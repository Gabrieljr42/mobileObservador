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

/** Formats an evidenced date/time without dropping the documented hour or offset. */
export function formatTemporal(
  value?: string | null,
  timezone?: string | null,
  precision: 'day' | 'instant' = 'instant',
): string {
  if (!value || precision === 'day' || /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) return formatDate(value);
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return formatDate(raw);

  const date = new Date(raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw);
  if (Number.isNaN(date.getTime())) return raw;
  if (match[4] && timezone && timezone !== 'UTC') {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date).replace(', ', ' às ');
    return `${formatted} (${timezone})`;
  }
  const zone = match[4] ? (match[4] === 'Z' ? 'UTC' : `UTC${match[4]}`) : (timezone || 'fuso não informado');
  return `${formatDate(match[1])} às ${match[2]}:${match[3]}${zone ? ` (${zone})` : ''}`;
}

type PublishedRawData = Record<string, unknown> | null | undefined;
const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const currentAmendmentPeriod = (rawData: PublishedRawData) => {
  const root = asRecord(rawData)?.tenderproof;
  const amendments = asRecord(root)?.amendments;
  const latest = Array.isArray(amendments) && amendments.length ? asRecord(amendments[amendments.length - 1]) : null;
  return asRecord(asRecord(latest?.periods)?.current);
};

/** Formats a published calendar field without borrowing registration precision for exam dates. */
export function formatPublishedTemporal(
  value: string | null | undefined,
  rawData: PublishedRawData,
  field: 'inscricao_inicio' | 'inscricao_fim' | 'prova_data',
): string {
  if (!value) return formatDate(value);
  const root = asRecord(rawData)?.tenderproof;
  const precisionRoot = asRecord(root)?.date_precision;
  const ownPrecision = field === 'prova_data'
    ? asRecord(rawData)?.[`${field}_precision`] || asRecord(precisionRoot)?.[field] || asRecord(root)?.[`${field}_precision`]
    : undefined;
  if (field === 'prova_data') {
    if (ownPrecision === 'instant') {
      const ownTimezone = asRecord(rawData)?.[`${field}_timezone`] || asRecord(root)?.[`${field}_timezone`] || null;
      return formatTemporal(value, typeof ownTimezone === 'string' ? ownTimezone : null, 'instant');
    }
    if (ownPrecision === 'day') return formatDate(value);
  } else {
    const period = currentAmendmentPeriod(rawData);
    const side = field === 'inscricao_fim' ? 'end' : 'start';
    const precision = period?.[`${side}_precision`] || period?.precision;
    if (precision === 'instant') return formatTemporal(value, typeof period?.timezone === 'string' ? period.timezone : null, 'instant');
    if (precision === 'day') return formatDate(value);
  }
  const match = String(value).match(/[T ](\d{2}):(\d{2})/);
  return match && !(match[1] === '00' && match[2] === '00') ? formatTemporal(value) : formatDate(value);
}

/** Formats a documented amendment event without inventing a timezone. */
export function formatAmendmentEvent(event: Record<string, unknown>): string {
  const nested = asRecord(event.local_time);
  const source = nested ?? event;
  const date = source.date ?? source.value;
  if (!date) return 'Data não informada';
  const start = source.start_time ?? source.start;
  const end = source.end_time ?? source.end;
  if (source.precision === 'local_time' || start || end) {
    const time = start ? `às ${String(start)}${end ? `–${String(end)}` : ''}` : end ? `até ${String(end)}` : '';
    const timezone = source.timezone || 'fuso não informado';
    return `${formatDate(String(date))}${time ? ` ${time}` : ''} (${timezone})`;
  }
  const timezone = typeof source.timezone === 'string' ? source.timezone : null;
  const precision = source.precision === 'day' ? 'day' : 'instant';
  const first = formatTemporal(String(date), timezone, precision);
  const finish = source.ends_at ?? source.end;
  return finish ? `${first} a ${formatTemporal(String(finish), timezone, source.end_precision === 'day' ? 'day' : precision)}` : first;
}

/** Shows an evidenced changed value without applying a timezone that was not supplied. */
export function workloadChanges(previous: unknown, current: unknown): Array<{ name: string; field: 'jornada' | 'remuneracao'; previous: string; current: string }> | null {
  if (!Array.isArray(previous) || !Array.isArray(current) || previous.length !== current.length) return null;
  const changes = [];
  for (let index = 0; index < previous.length; index += 1) {
    const before = asRecord(previous[index]);
    const after = asRecord(current[index]);
    if (!before || !after || typeof before.nome !== 'string' || before.nome !== after.nome) return null;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const supported = new Set(['jornada', 'remuneracao']);
    if ([...keys].some(key => !supported.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))) return null;
    for (const field of ['jornada', 'remuneracao'] as const) {
      if (before[field] !== after[field]) {
        if (typeof before[field] !== 'string' || typeof after[field] !== 'string') return null;
        changes.push({ name: before.nome, field, previous: before[field], current: after[field] });
      }
    }
  }
  return changes.length ? changes : null;
}

export function formatChangedValue(value: unknown): string {
  if (value == null || value === '') return 'Não informado';
  if (typeof value === 'string') {
    return /^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2})/.test(value)
      ? formatTemporal(value, null, 'instant')
      : /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value;
  }
  if (typeof value === 'object') {
    const record = asRecord(value);
    if (!record) return 'Valor estruturado atualizado';
    const date = record.date ?? record.value ?? record.start ?? record.start_at;
    if (typeof date === 'string') {
      const precision = record.precision === 'day' ? 'day' : 'instant';
      const timezone = typeof record.timezone === 'string' ? record.timezone : null;
      return formatTemporal(date, timezone, precision);
    }
    if (Array.isArray(value)) return 'Lista atualizada';
    const labels: Record<string, string> = {
      jornada: 'jornada', remuneracao: 'remuneração', requisitos: 'requisitos',
      vagas_imediatas: 'seleções imediatas', vagas_cadastro_reserva: 'seleções em cadastro de reserva',
      precision: 'precisão', timezone: 'fuso horário',
    };
    const visible = Object.entries(record)
      .filter(([key, item]) => !['provenance', 'evidence', 'sha256', 'content_hash'].includes(key) && item != null)
      .map(([key, item]) => `${labels[key] || 'informação'}: ${typeof item === 'object' ? 'valor estruturado' : String(item)}`);
    return visible.length ? visible.join('; ') : 'Valor estruturado atualizado';
  }
  return String(value);
}

/** Replaces ISO date/datetime fragments inside summaries and descriptions. */
export function formatDatesInText(value?: string | null): string {
  if (!value) return '';
  return value.replace(ISO_DATE_PATTERN, match => formatDate(match));
}
