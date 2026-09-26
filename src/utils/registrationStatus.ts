import type { Concurso } from '../types/concurso';

export type RegistrationSituation = 'open' | 'upcoming' | 'closed' | 'unknown';

type Boundary = {
  time: number;
  precision: 'day' | 'instant';
};

type RegistrationInput = Pick<Concurso, 'status' | 'inscricao_inicio' | 'inscricao_fim'> & {
  raw_data?: Record<string, unknown> | null;
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIDNIGHT_API_DATE = /^(\d{4})-(\d{2})-(\d{2})[ T]00:00(?::00(?:\.0+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const CALENDAR_TIMEZONE = 'America/Sao_Paulo';

const normalize = (value?: string | null) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const canonicalSituation = (status?: string | null): RegistrationSituation => {
  switch (normalize(status)) {
    case 'inscricoes abertas':
    case 'inscricao aberta':
      return 'open';
    case 'inscricoes em breve':
      return 'upcoming';
    case 'encerrado':
    case 'encerrada':
    case 'finalizado':
    case 'finalizada':
    case 'homologado':
    case 'homologada':
      return 'closed';
    default:
      // Labels such as "Em andamento" do not prove that registrations are open.
      return 'unknown';
  }
};

const sourcePrecision = (rawData: Record<string, unknown> | null | undefined, field: string, endOfDay: boolean) => {
  const root = rawData && typeof rawData.tenderproof === 'object' && rawData.tenderproof
    ? rawData.tenderproof as Record<string, unknown>
    : null;
  const period = root && typeof root.current_period === 'object' && root.current_period
    ? root.current_period as Record<string, unknown>
    : null;
  const periods = root && typeof root.periods === 'object' && root.periods
    ? root.periods as Record<string, unknown>
    : null;
  const current = periods && typeof periods.current === 'object' && periods.current
    ? periods.current as Record<string, unknown>
    : null;
  const amendments = root && Array.isArray(root.amendments) ? root.amendments : [];
  const latestAmendment = amendments.length && typeof amendments[amendments.length - 1] === 'object'
    ? amendments[amendments.length - 1] as Record<string, unknown>
    : null;
  const amendmentPeriods = latestAmendment && typeof latestAmendment.periods === 'object' && latestAmendment.periods
    ? latestAmendment.periods as Record<string, unknown>
    : null;
  const amendmentCurrent = amendmentPeriods && typeof amendmentPeriods.current === 'object' && amendmentPeriods.current
    ? amendmentPeriods.current as Record<string, unknown>
    : null;
  const side = endOfDay ? 'end' : 'start';
  const values = [
    rawData?.[`${field}_precision`],
    (rawData?.date_precision as Record<string, unknown> | undefined)?.[field],
    root?.[`${field}_precision`],
    (root?.date_precision as Record<string, unknown> | undefined)?.[field],
    period?.[`${side}_precision`], period?.precision,
    current?.[`${side}_precision`], current?.precision,
    amendmentCurrent?.[`${side}_precision`], amendmentCurrent?.precision,
  ];
  return values.find(value => value === 'day' || value === 'instant') as 'day' | 'instant' | undefined;
};

const timezoneOffsetMinutes = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CALENDAR_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  const representedUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'), date.getUTCMilliseconds());
  return (representedUtc - date.getTime()) / 60000;
};

const calendarInstant = (year: number, month: number, day: number, endOfDay: boolean) => {
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let instant = wallUtc;
  // Resolve the São Paulo wall-clock date without applying the device's zone.
  instant = wallUtc - timezoneOffsetMinutes(new Date(instant)) * 60_000;
  instant = wallUtc - timezoneOffsetMinutes(new Date(instant)) * 60_000;
  return instant;
};

const localDayBoundary = (value: string, endOfDay: boolean): Boundary | null => {
  const match = value.match(DATE_ONLY) || value.match(MIDNIGHT_API_DATE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(calendarInstant(year, month, day, endOfDay));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CALENDAR_TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  // Reject impossible calendar dates after timezone conversion.
  if (part('year') !== year || part('month') !== month || part('day') !== day) return null;
  return { time: date.getTime(), precision: 'day' };
};

const parseBoundary = (value: string | null | undefined, endOfDay: boolean, precision?: 'day' | 'instant'): Boundary | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // API responses serialize document dates without an hour as midnight. Keep
  // those values day-precise so the end date remains open through that day.
  const day = precision === 'instant' ? null : localDayBoundary(raw, endOfDay);
  if (day) return day;

  const normalized = raw.includes(' ') && !raw.includes('T')
    ? raw.replace(' ', 'T')
    : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return { time: parsed.getTime(), precision: 'instant' };
};

/**
 * Derives registration situation from the published period. This is a view
 * classification only: it never mutates or replaces Concurso.status.
 *
 * Date-only values use the device's calendar day. Values with an explicit
 * hour/timezone are compared as instants, which preserves retification times.
 */
export const registrationSituation = (
  concurso: RegistrationInput,
  now: Date = new Date(),
): RegistrationSituation => {
  const start = parseBoundary(concurso.inscricao_inicio, false, sourcePrecision(concurso.raw_data, 'inscricao_inicio', false));
  const end = parseBoundary(concurso.inscricao_fim, true, sourcePrecision(concurso.raw_data, 'inscricao_fim', true));

  if (start && end) {
    if (start.time > end.time) return 'unknown';
    const nowTime = now.getTime();
    if (!Number.isFinite(nowTime)) return 'unknown';
    if (nowTime < start.time) return 'upcoming';
    // A date-only end is inclusive for the whole calendar day. An explicit
    // hour marks the closing instant itself, so equality is already closed.
    if (end.precision === 'day' ? nowTime <= end.time : nowTime < end.time) return 'open';
    return 'closed';
  }

  // A single bound cannot establish a period. A canonical status may still
  // be useful when the source explicitly supplied one, but generic labels are
  // deliberately left unknown.
  return canonicalSituation(concurso.status);
};

export const isRegistrationOpen = (
  concurso: RegistrationInput,
  now?: Date,
) => registrationSituation(concurso, now) === 'open';

export const isRegistrationClosed = (
  concurso: RegistrationInput,
  now?: Date,
) => registrationSituation(concurso, now) === 'closed';
