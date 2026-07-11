export function formatQty(qty: string, unit: string): string {
  const parsed = Number(qty);
  if (Number.isNaN(parsed)) return `${qty} ${unit}`;
  return `${parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(3).replace(/\.?0+$/, '')} ${unit}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
