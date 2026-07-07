// Period window helpers shared by the consumption views (electricity, water):
// an anchor date + a granularity define an inclusive [date_from, date_to] range,
// navigable with prev/next.

export type Granularity = 'hour' | 'day' | 'month' | 'year';

export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function periodRange(anchor: Date, granularity: Granularity): { from: string; to: string } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  switch (granularity) {
    case 'hour': // one day, hour by hour
      return { from: isoDate(anchor), to: isoDate(anchor) };
    case 'day': // one month, day by day
      return { from: isoDate(new Date(year, month, 1)), to: isoDate(new Date(year, month + 1, 0)) };
    case 'month': // one year, month by month
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case 'year': // a decade, year by year
      return { from: `${year - 9}-01-01`, to: `${year}-12-31` };
  }
}

export function shiftAnchor(anchor: Date, granularity: Granularity, direction: 1 | -1): Date {
  const next = new Date(anchor);
  switch (granularity) {
    case 'hour':
      next.setDate(next.getDate() + direction);
      break;
    case 'day':
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
      break;
    case 'month':
    case 'year':
      next.setFullYear(next.getFullYear() + direction);
      break;
  }
  return next;
}

export function periodLabel(anchor: Date, granularity: Granularity, locale: string): string {
  switch (granularity) {
    case 'hour':
      return anchor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'day':
      return anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'month':
      return String(anchor.getFullYear());
    case 'year':
      return `${anchor.getFullYear() - 9} – ${anchor.getFullYear()}`;
  }
}
