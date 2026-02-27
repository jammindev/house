import { useTranslation } from 'react-i18next';

type ZoneItem = {
  id: string;
  name: string;
  fullPath: string;
  color: string;
  parentId: string | null;
};

type ZonesPageProps = {
  householdId: string | null;
  initialZones: ZoneItem[];
};

export default function ZonesNode({ initialZones }: ZonesPageProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('zones.app_title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('zones.count_loaded', { count: initialZones.length })}</p>

      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {initialZones.length ? (
          initialZones.map((zone) => (
            <li key={zone.id}>
              <span
                className="inline-block h-2 w-2 rounded-full mr-2 align-middle"
                style={{ backgroundColor: zone.color }}
              />
              {zone.fullPath}
            </li>
          ))
        ) : (
          <li>{t('zones.no_zones')}</li>
        )}
      </ul>
    </section>
  );
}
