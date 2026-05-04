import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/design-system/checkbox-field';
import { fetchZones, type Zone } from '@/lib/api/zones';
import { cn } from '@/lib/utils';

interface ZoneMultiSelectProps {
  /** id of the wrapping container — pair with FormField htmlFor */
  id: string;
  value: string[];
  onChange: (zoneIds: string[]) => void;
  /** Limit how tall the panel can grow before scrolling. Default `max-h-44`. */
  maxHeightClass?: string;
  className?: string;
}

export function ZoneMultiSelect({
  id,
  value,
  onChange,
  maxHeightClass = 'max-h-44',
  className,
}: ZoneMultiSelectProps) {
  const { t } = useTranslation();
  const { data: zones = [], isLoading } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: fetchZones,
  });

  const toggle = (zoneId: string, checked: boolean) => {
    onChange(checked ? [...value, zoneId] : value.filter((id) => id !== zoneId));
  };

  return (
    <div
      id={id}
      className={cn(
        'space-y-1.5 overflow-y-auto rounded-md border border-border bg-background p-2',
        maxHeightClass,
        className,
      )}
    >
      {isLoading && zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('zones.no_zones')}</p>
      ) : (
        zones.map((z) => (
          <CheckboxField
            key={z.id}
            id={`${id}-${z.id}`}
            label={z.full_path ?? z.name}
            checked={value.includes(z.id)}
            onChange={(checked) => toggle(z.id, checked)}
          />
        ))
      )}
    </div>
  );
}
