import type { TFunction } from 'i18next';
import type { Briefing } from '@/lib/api/briefings';

/** Python weekday order: Monday=0 … Sunday=6. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** "16:00:00" | "16:00" → "16:00" (native <input type="time"> value). */
export function toHHMM(value: string): string {
  return (value || '').slice(0, 5);
}

/** Human summary of a briefing's schedule, e.g. "Tous les jours · 16:00". */
export function scheduleSummary(briefing: Briefing, t: TFunction): string {
  if (!briefing.send_times.length) return t('briefings.schedule.none');
  const times = [...briefing.send_times].map(toHHMM).sort().join(', ');
  const days = briefing.weekdays.length
    ? [...briefing.weekdays]
        .sort((a, b) => a - b)
        .map((d) => t(`briefings.schedule.weekdaysShort.${WEEKDAY_KEYS[d]}`))
        .join(', ')
    : t('briefings.schedule.everyDay');
  return `${days} · ${times}`;
}

/** Localized "next send" label, or null when there is none. */
export function formatNextSend(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
