import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Layers, NotebookText } from 'lucide-react';
import { Button } from '@/design-system/button';
import { useZone, useZones, zoneKeys, buildZoneTree, useEquipmentByZone, useZoneTasks, useZoneActivity, useZoneProjects } from './hooks';
import ZoneDialog from './ZoneDialog';

export default function ZoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = React.useState(false);

  const { data: zone, isLoading, error } = useZone(id ?? '');
  const { data: allZones = [] } = useZones();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: zoneKeys.all });
  }, [qc]);

  // Find children of this zone from the flat list
  const children = React.useMemo(() => {
    if (!id) return [];
    return allZones.filter((z) => (z.parentId ?? z.parent) === id);
  }, [allZones, id]);

  // Build parent path by traversing ancestors
  const parentName = React.useMemo(() => {
    if (!zone) return null;
    const parentId = zone.parentId ?? zone.parent;
    if (!parentId) return null;
    const parent = allZones.find((z) => z.id === parentId);
    return parent?.name ?? null;
  }, [zone, allZones]);

  const parentId = zone?.parentId ?? zone?.parent ?? null;

  const { depthMap } = React.useMemo(() => buildZoneTree(allZones), [allZones]);

  const { data: equipmentData = [] } = useEquipmentByZone(id ?? '');
  const { data: tasksData } = useZoneTasks(id ?? '');
  const { data: activityData } = useZoneActivity(id ?? '');
  const { data: projectsData = [] } = useZoneProjects(id ?? '');

  const zoneTasks = tasksData?.items ?? [];
  const zoneActivity = (activityData?.items ?? []).filter((item) => item.type !== 'todo');

  if (!id) return null;

  if (isLoading && !zone) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t('zones.detail.notFound')}
        <Link to="/app/zones" className="ml-2 underline hover:no-underline">
          {t('zones.title')}
        </Link>
      </div>
    );
  }

  const displayColor = zone.color || '#94a3b8';

  return (
    <>
      <section className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: displayColor }}
              />
              <h1 className="text-xl font-semibold text-foreground">{zone.name}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {parentId && parentName ? (
                <Link
                  to={`/app/zones/${parentId}`}
                  className="hover:text-foreground hover:underline"
                >
                  {parentName}
                </Link>
              ) : (
                t('zones.detail.subtitle')
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/interactions/new?zone_id=${id}`)}
            >
              {t('zones.detail.add_activity')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/interactions/new?type=todo&zone_id=${id}`)}
            >
              {t('zones.detail.add_task')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              {t('zones.detail.edit')}
            </Button>
          </div>
        </div>

        {/* Info card */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: displayColor }}
            >
              <Layers className="h-5 w-5 text-slate-600" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t('zones.detail.infoTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('zones.detail.infoSubtitle')}</p>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/40 bg-background/60 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('zones.detail.parentLabel')}
              </dt>
              <dd className="mt-2 text-sm text-foreground">
                {parentId && parentName ? (
                  <Link
                    to={`/app/zones/${parentId}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {parentName}
                  </Link>
                ) : (
                  t('zones.noParent')
                )}
              </dd>
            </div>

            <div className="rounded-xl border border-border/40 bg-background/60 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('zones.detail.childrenLabel')}
              </dt>
              <dd className="mt-2 text-sm text-foreground">
                {zone.children_count ?? children.length}
              </dd>
            </div>
          </dl>

          {/* Notes */}
          <div className="mt-4 rounded-xl border border-border/40 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <NotebookText className="h-4 w-4 text-indigo-600" />
              {t('zones.detail.notesLabel')}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {zone.note?.trim() ? (
                zone.note
              ) : (
                <span className="text-muted-foreground">{t('zones.detail.noteEmpty')}</span>
              )}
            </p>
          </div>
        </section>

        {/* Children list */}
        {children.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('zones.detail.childrenLabel')}
            </h3>
            <ul className="space-y-1">
              {children
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                .map((child) => {
                  const childColor = child.color || '#94a3b8';
                  const childDepth = depthMap.get(child.id) ?? 0;
                  return (
                    <li key={child.id}>
                      <Link
                        to={`/app/zones/${child.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        style={{ paddingLeft: 8 + childDepth * 8 }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: childColor }}
                        />
                        <span className="truncate">{child.name}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ) : null}

        {/* Equipment in this zone */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.equipment_title')}
          </h3>
          {equipmentData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('zones.detail.equipment_empty')}</p>
          ) : (
            <ul className="space-y-1">
              {equipmentData.map((eq) => (
                <li key={eq.id}>
                  <Link
                    to={`/app/equipment/${eq.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="truncate">{eq.name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {eq.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Open tasks */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.tasks_title')}
          </h3>
          {zoneTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('zones.detail.tasks_empty')}</p>
          ) : (
            <ul className="space-y-1">
              {zoneTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <span className="truncate">{task.subject}</span>
                  {task.status ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {task.status}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.activities_title')}
          </h3>
          {zoneActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('zones.detail.activities_empty')}</p>
          ) : (
            <ul className="space-y-1">
              {zoneActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.occurred_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {item.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Active projects */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('zones.detail.projects_title')}
          </h3>
          {projectsData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('zones.detail.projects_empty')}</p>
          ) : (
            <ul className="space-y-1">
              {projectsData.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/app/projects/${project.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="truncate">{project.title}</span>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {project.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <ZoneDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingZone={zone}
        onSaved={() => {
          setEditOpen(false);
          handleSaved();
        }}
      />
    </>
  );
}
