import { AlertTriangle, Bell, CloudSun, Mail, PackageX, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Icône par type de notification.
 *
 * Un registre plutôt qu'une chaîne de ternaires dans la carte : la famille
 * « un membre a fait quelque chose » est faite pour grandir, et une expression
 * `a ? X : b ? Y : c ? Z : Bell` cesse d'être lisible au quatrième type.
 *
 * Un type absent tombe sur `Bell` — pas une erreur, juste le glyphe générique.
 * Les libellés, eux, vivent dans `notifications.type.*` des quatre catalogues et
 * sont vérifiés depuis Python (`test_household_fanout.py`), seul côté qui
 * connaît la liste complète des types silenciables.
 */
const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  household_invitation: Mail,
  household_member_joined: UserPlus,
  stock_low: AlertTriangle,
  stock_out: PackageX,
  weather_alert: CloudSun,
};

/**
 * Rendu en composant, et non un `const Icon = iconFor(type)` au point d'appel :
 * le lint refuse ce dernier, l'appel de fonction l'empêchant de prouver qu'on ne
 * crée pas un composant neuf à chaque rendu.
 */
export function NotificationIcon({ type, className }: { type: string; className?: string }) {
  const Icon = NOTIFICATION_ICONS[type] ?? Bell;
  return <Icon className={className} />;
}
