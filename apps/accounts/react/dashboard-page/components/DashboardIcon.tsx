import type { DashboardIconName } from '../types';
import { ICONS } from '../constants';

interface DashboardIconProps {
  name: DashboardIconName;
  className?: string;
}

export function DashboardIcon({ name, className }: DashboardIconProps) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
