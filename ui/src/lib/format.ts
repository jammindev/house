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

/**
 * Montant en devise (EUR), localisé via `Intl.NumberFormat`.
 * Formatter unique de l'app — ne jamais réintroduire un `.toFixed() + ' €'` local.
 *
 * - vide / null → « — » ; non numérique → renvoyé tel quel.
 * - `fractionDigits` force le nombre de décimales (0 pour les montants « ronds »
 *   des cards projet / dashboard) ; par défaut le comportement devise EUR (2).
 */
export function formatAmount(
  value?: string | number | null,
  options?: { fractionDigits?: number },
): string {
  if (value == null || value === '') return '—';
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  const digits = options?.fractionDigits;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    ...(digits != null ? { minimumFractionDigits: digits, maximumFractionDigits: digits } : {}),
  }).format(parsed);
}

/** Mois + année localisés (« juillet 2026 ») — en-têtes de regroupement chronologique. */
export function formatMonthYear(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(d);
}

/**
 * Le séparateur décimal de la locale de lecture — « , » en français, « . » en
 * anglais. Même source que `formatAmount` (la locale du navigateur), pour qu'un
 * montant saisi et le même montant réaffiché ne se lisent pas de deux façons.
 */
export function decimalSeparator(locale?: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === 'decimal')?.value ?? '.';
}

/**
 * Les séparateurs de groupe d'un montant collé. `\s` couvre l'espace insécable
 * (U+00A0) et l'espace fine insécable (U+202F) — celle que produit `Intl` en
 * français, donc celle qu'on récupère en copiant un montant affiché par l'app.
 */
const GROUP_SPACES = /\s/g;

/**
 * Frappe utilisateur → décimal canonique (séparateur point), ou `null` si la
 * frappe n'est pas un décimal acceptable — auquel cas `DecimalInput` l'ignore.
 *
 * **Les deux séparateurs sont toujours acceptés, quelle que soit la locale** : un
 * pavé numérique et un copier-coller donnent un point, un clavier français une
 * virgule, et l'utilisateur ne choisit pas la locale de son navigateur.
 *
 * Ne jamais rendre un décimal invalide même en cours de frappe : « 12, » vaut
 * « 12 » (le séparateur en attente ne part pas vers l'API), « ,5 » vaut « 0.5 ».
 */
export function parseDecimalInput(
  raw: string,
  options?: { decimals?: number; allowNegative?: boolean },
): string | null {
  const decimals = options?.decimals ?? 2;
  const compact = raw.replace(GROUP_SPACES, '').replace(',', '.');
  if (compact === '') return '';

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(compact);
  if (!match) return null;

  const [, sign, whole, fraction] = match;
  if (sign && !options?.allowNegative) return null;
  if (fraction != null && fraction.length > decimals) return null;

  if (whole === '' && !fraction) return '';          // « - », « , », « -, »
  if (!fraction) return `${sign}${whole}`;           // « 12 », « 12, »
  return `${sign}${whole || '0'}.${fraction}`;       // « 12,5 », « ,5 »
}

/**
 * Décimal canonique → ce que l'utilisateur relit dans son champ : le séparateur
 * de sa locale, et **jamais** de séparateur de groupe (« 1 234,56 » dans un champ
 * rend l'édition au caret illisible).
 */
export function toDecimalDisplay(value: string, locale?: string): string {
  if (!value) return '';
  if (!/^-?\d*\.?\d*$/.test(value)) return value;
  return value.replace('.', decimalSeparator(locale));
}

/**
 * `Date` → `YYYY-MM-DD` **dans le fuseau du navigateur**.
 *
 * `toISOString().slice(0, 10)` convertit d'abord en UTC : à Paris, tout ce qui
 * se passe entre minuit et 2 h du matin est daté de la veille, et une borne de
 * période construite à minuit local recule d'un jour entier. C'est le formatteur
 * unique des dates de calendrier, comme `formatAmount` l'est des montants — ne
 * jamais réintroduire un `toISOString().slice(0, 10)` local.
 */
export function toLocalISODate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** La date d'aujourd'hui telle que l'utilisateur la lit — valeur par défaut des formulaires. */
export function todayISO(): string {
  return toLocalISODate(new Date());
}

/** true si la date est dans le passé (garantie / échéance dépassée, péremption…). */
export function isPast(value?: string | null): boolean {
  if (!value) return false;
  return new Date(value) < new Date();
}
