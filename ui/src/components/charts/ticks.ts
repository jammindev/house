import type { Granularity } from '@/lib/period';

// Libellés d'axe et d'infobulle du graphe de consommation. À part du composant
// parce qu'ils se testent sans rendu — et que react-refresh interdit d'exporter
// autre chose qu'un composant depuis un fichier de composant.

export function formatTick(
  ts: string,
  granularity: Granularity,
  locale: string,
  crossesMonths = false,
): string {
  const date = new Date(ts);
  switch (granularity) {
    case 'hour':
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    case 'day':
      // Élec/eau tiennent dans un mois : le numéro du jour suffit. Le stock, lui,
      // affiche 30 ou 90 jours d'affilée — sans le mois, l'axe répète « 13 »
      // deux ou trois fois et ne situe plus rien.
      return date.toLocaleDateString(
        locale,
        crossesMonths ? { day: 'numeric', month: 'short' } : { day: 'numeric' },
      );
    case 'month':
      return date.toLocaleDateString(locale, { month: 'short' });
    case 'year':
      return date.toLocaleDateString(locale, { year: 'numeric' });
  }
}

export function formatLabel(ts: string, granularity: Granularity, locale: string): string {
  const date = new Date(ts);
  switch (granularity) {
    case 'hour':
      return date.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    case 'day':
      return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    case 'month':
      return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'year':
      return date.toLocaleDateString(locale, { year: 'numeric' });
  }
}
