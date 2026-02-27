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
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">Zones mini-app</h2>
      <p className="mt-1 text-sm text-muted-foreground">{initialZones.length} zone(s) loaded from SSR props.</p>

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
          <li>No zones yet.</li>
        )}
      </ul>
    </section>
  );
}
