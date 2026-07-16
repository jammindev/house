/**
 * Formatters partagés — date, date+heure, montant.
 * Centralise les définitions qui étaient dupliquées dans une douzaine de pages/cards.
 */

/** Date « medium » localisée, ou « — » si vide / invalide renvoyé tel quel. */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}

/** Date + heure « medium/short » localisée, ou « — » si vide. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Montant en euros (« 12.00 € »), ou « — » si vide / non numérique renvoyé tel quel. */
export function formatAmount(value?: string | number | null): string {
  if (value == null || value === '') return '—';
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return `${parsed.toFixed(2)} €`;
}

/** true si la date est dans le passé (garantie / échéance dépassée, péremption…). */
export function isPast(value?: string | null): boolean {
  if (!value) return false;
  return new Date(value) < new Date();
}
