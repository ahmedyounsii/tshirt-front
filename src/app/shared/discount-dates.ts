import { Language } from '../services/language.service';

const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-US' };

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

// "Mon, Nov 3, 2:00 PM" / "lun. 3 nov., 14:00"
export const formatWhen = (date: string | Date, lang: Language): string =>
  new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

// "in 3 days", "2 hours ago"...; under a minute counts as one
export const relativeTime = (date: string | Date, lang: Language, now = Date.now()): string => {
  const diff = new Date(date).getTime() - now;
  const format = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return format.format(Math.round(diff / ms), unit);
  }
  return format.format(diff < 0 ? -1 : 1, 'minute');
};

// "3 days 4 hours", the length of a discount
export const formatDuration = (ms: number, lang: Language): string => {
  const parts: string[] = [];
  let left = Math.max(0, ms);
  for (const [unit, size] of UNITS) {
    const count = Math.floor(left / size);
    left -= count * size;
    if (count) {
      parts.push(new Intl.NumberFormat(LOCALES[lang], { style: 'unit', unit, unitDisplay: 'long' }).format(count));
    }
    if (parts.length === 2) break;
  }
  return parts.join(' ');
};

// <input type="datetime-local"> works in local time without a zone: "2026-11-03T14:00"
export const toLocalInput = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Back to an ISO date, null when empty or invalid
export const fromLocalInput = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
