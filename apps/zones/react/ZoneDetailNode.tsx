import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';

import ZoneEditDialog from './components/ZoneEditDialog';
import ZoneDetailView from './components/ZoneDetailView';
import ZonePhotoGallery from './components/ZonePhotoGallery';
import { useZoneDetail } from './hooks/useZoneDetail';
import { useZones } from './hooks/useZones';
import { computeZoneTree } from './lib/tree';
import type { ZoneDetailPageProps, ZoneMutationPayload } from './types/zones';
import { fetchEquipmentList, type EquipmentListItem } from '@/lib/api/equipment';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { fetchProjects, type ProjectListItem } from '@/lib/api/projects';

type SubZone = { id: string; name: string; color: string; full_path?: string };

type ContextualData = {
  subZones: SubZone[];
  equipment: EquipmentListItem[];
  openTasks: InteractionListItem[];
  recentActivity: InteractionListItem[];
  activeProjects: ProjectListItem[];
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return `Il y a ${Math.floor(diffDays / 365)} an(s)`;
}

export default function ZoneDetailNode(props: ZoneDetailPageProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = React.useState(false);

  const { zones, updateZone } = useZones();
  const { zonesById, sortedZones, zoneDepths } = React.useMemo(() => computeZoneTree(zones), [zones]);

  const { zone, photos, loading, error, attachPhoto, reload } = useZoneDetail(props);

  const childrenCount = zone?.children_count ?? 0;

  const [contextual, setContextual] = React.useState<ContextualData>({
    subZones: [],
    equipment: [],
    openTasks: [],
    recentActivity: [],
    activeProjects: [],
  });
  const [contextualLoading, setContextualLoading] = React.useState(true);

  React.useEffect(() => {
    if (!props.zoneId) return;

    const zoneId = props.zoneId;

    setContextualLoading(true);

    const subZonesFetch = fetch(`/api/zones/${zoneId}/children/`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.ok ? r.json() as Promise<SubZone[]> : Promise.resolve([]))
      .catch(() => []);

    const equipmentFetch = fetchEquipmentList({ zone: zoneId, ordering: 'name' });

    const tasksFetch = fetchInteractions({ zone: zoneId, type: 'todo', limit: 20 })
      .then((result) =>
        result.items.filter(
          (item) => item.status !== 'done' && item.status !== 'archived'
        )
      );

    const activityFetch = fetchInteractions({ zone: zoneId, limit: 10 })
      .then((result) => result.items.filter((item) => item.type !== 'todo').slice(0, 5));

    const projectsFetch = fetchProjects({ zone: zoneId, status: 'active', limit: 20 });

    Promise.allSettled([subZonesFetch, equipmentFetch, tasksFetch, activityFetch, projectsFetch])
      .then(([subZonesRes, equipmentRes, tasksRes, activityRes, projectsRes]) => {
        setContextual({
          subZones: subZonesRes.status === 'fulfilled' ? (subZonesRes.value as SubZone[]) : [],
          equipment: equipmentRes.status === 'fulfilled' ? equipmentRes.value : [],
          openTasks: tasksRes.status === 'fulfilled' ? tasksRes.value : [],
          recentActivity: activityRes.status === 'fulfilled' ? activityRes.value : [],
          activeProjects: projectsRes.status === 'fulfilled' ? projectsRes.value : [],
        });
      })
      .finally(() => setContextualLoading(false));
  }, [props.zoneId]);

  async function handleEdit(zoneId: string, payload: ZoneMutationPayload) {
    await updateZone(zoneId, payload);
    await reload();
  }

  if (loading && !zone) {
    return <p className="text-sm text-muted-foreground">{t('zones.loading')}</p>;
  }

  if (!zone) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('zones.loading_error_title')}</AlertTitle>
        <AlertDescription>{error || t('zones.detail.notFound')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{zone.name}</h2>
          <p className="text-sm text-muted-foreground">
            {zone.parent?.name && zone.parent.id ? (
              <a href={`/app/zones/${zone.parent.id}/`} className="hover:text-foreground hover:underline">
                {zone.parent.name}
              </a>
            ) : (
              t('zones.detail.subtitle')
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.createTaskUrl ? (
            <a
              href={props.createTaskUrl}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              {t('zones.detail.addTask', { defaultValue: 'Ajouter une tâche' })}
            </a>
          ) : null}
          {props.createActivityUrl ? (
            <a
              href={props.createActivityUrl}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              {t('zones.detail.addActivity', { defaultValue: 'Ajouter une activité' })}
            </a>
          ) : null}
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            {t('zones.detail.edit')}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('zones.loading_error_title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ZoneDetailView zone={zone} childrenCount={childrenCount} photosCount={photos.length} />

      <ZonePhotoGallery
        photos={photos}
        loading={loading}
        onAttachPhoto={async (documentId, note) => {
          await attachPhoto(documentId, note);
        }}
      />

      {!contextualLoading && contextual.subZones.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.subZonesTitle', { defaultValue: 'Sous-zones' })}
          </h3>
          <ul className="space-y-1">
            {contextual.subZones.map((sub) => (
              <li key={sub.id}>
                <a
                  href={`/app/zones/${sub.id}/`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sub.color || '#94a3b8' }}
                  />
                  {sub.full_path ?? sub.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!contextualLoading && contextual.equipment.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.equipmentTitle', { defaultValue: 'Équipements' })}
          </h3>
          <ul className="space-y-1">
            {contextual.equipment.map((eq) => (
              <li key={eq.id}>
                <a
                  href={`/app/equipment/${eq.id}/`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span>{eq.name}</span>
                  <span className="text-xs text-muted-foreground">{eq.category}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!contextualLoading && contextual.openTasks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.openTasksTitle', { defaultValue: 'Tâches ouvertes' })}
          </h3>
          <ul className="space-y-1">
            {contextual.openTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <a href={`/app/interactions/?type=todo`} className="truncate hover:underline">
                  {task.subject}
                </a>
                {task.occurred_at ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeDate(task.occurred_at)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {props.createTaskUrl ? (
            <a href={props.createTaskUrl} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              {t('zones.detail.addTask', { defaultValue: 'Ajouter une tâche' })} →
            </a>
          ) : null}
        </div>
      ) : null}

      {!contextualLoading && contextual.recentActivity.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.recentActivityTitle', { defaultValue: 'Activité récente' })}
          </h3>
          <ul className="space-y-1">
            {contextual.recentActivity.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <span className="truncate text-foreground">{item.subject}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeDate(item.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!contextualLoading && contextual.activeProjects.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.activeProjectsTitle', { defaultValue: 'Projets actifs' })}
          </h3>
          <ul className="space-y-1">
            {contextual.activeProjects.map((project) => (
              <li key={project.id}>
                <a
                  href={`/app/projects/${project.id}/`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="truncate">{project.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{project.type}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sortedZones.length > 0 ? (
        <ZoneEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          zone={zone}
          zones={sortedZones}
          zonesById={zonesById}
          zoneDepths={zoneDepths}
          onSave={handleEdit}
        />
      ) : null}
    </section>
  );
}
