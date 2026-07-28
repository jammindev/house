/**
 * `'YYYY-MM'` → localized month label, e.g. « juillet 2026 ».
 *
 * Built from the parts, never from `new Date('2026-07')`: that string parses as UTC
 * midnight, which is the previous month's last day in any negative-offset zone — the
 * same trap `toISOString()` sets on the other side (see `lib/format`).
 */
export function monthLabel(month: string | undefined): string {
  if (!month) return '';
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return month;
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, mon - 1, 1),
  );
}
