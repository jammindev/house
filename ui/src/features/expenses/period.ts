export type PeriodPreset = 'currentMonth' | 'previousMonth' | 'last30Days' | 'currentYear' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  from?: string; // ISO date YYYY-MM-DD
  to?: string;   // ISO date YYYY-MM-DD (inclusive)
}

export function resolvePeriod(range: PeriodRange): { from?: string; to?: string } {
  const now = new Date();
  if (range.preset === 'currentMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (range.preset === 'previousMonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (range.preset === 'last30Days') {
    const to = now;
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (range.preset === 'currentYear') {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  return { from: range.from, to: range.to };
}
