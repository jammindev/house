import { formatMonthKey } from '@/lib/format';

/**
 * `'YYYY-MM'` → localized month label, e.g. « juillet 2026 ».
 *
 * Delegates to `formatMonthKey`, which is the same function: it builds the date
 * from its parts rather than from `new Date('2026-07')` (that string parses as
 * UTC midnight — the previous month's last day in any negative-offset zone), and
 * it formats in the language the app *writes*, not the browser's. Two copies of
 * a formatter drift; the one that gets fixed is never the one on screen.
 */
export function monthLabel(month: string | undefined): string {
  if (!month) return '';
  return formatMonthKey(month);
}
