import { CloudSun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FilterPill } from '@/design-system/filter-pill';

/**
 * Toggle for the temperature overlay on the consumption charts (parcours 17
 * Lot 6). Shared by the electricity + water pages; each owns its own state.
 */
export default function WeatherOverlayToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <FilterPill active={active} onClick={() => onToggle(!active)}>
      <CloudSun className="mr-1 inline h-3.5 w-3.5" />
      {t('weather.overlay.toggle')}
    </FilterPill>
  );
}
