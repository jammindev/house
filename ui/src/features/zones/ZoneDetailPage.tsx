import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers, NotebookText, FileText, ImageIcon } from 'lucide-react';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import { TabShell } from '@/components/TabShell';
import {
  useZone,
  useZones,
  buildZoneTree,
  useEquipmentByZone,
  useZoneTasks,
  useZoneActivity,
  useZoneProjects,
  useZoneDocuments,
  useZonePhotos,
} from './hooks';
import ZoneDialog from './ZoneDialog';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

// ── Tab types ──────────────────────────────────────────────

type Tab = 'info' | 'equipment' | 'tasks' | 'activity' | 'projects' | 'photos' | 'documents';
const TABS: Tab[] = ['info', 'equipment', 'tasks', 'activity', 'projects', 'photos', 'documents'];

// ── Tab: Info ──────────────────────────────────────────────

function TabInfo({
  zone,
  parentId,
  parentName,
  children,
  depthMap,
}: {
  zone: ReturnType<typeof useZone>['data'];
  parentId: string | null;
  parentName: string | null;
  children: NonNullable<ReturnType<typeof useZones>['data']>;
  depthMap: Map<string, number>;
}) {
  const { t } = useTranslation();
  if (!zone) return null;
  const displayColor = zone.color || '#94a3b8';

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full border"
            style={{ borderColor: displayColor }}
          >
            <Layers className="h-5 w-5 text-muted-foreground" />
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
            <NotebookText className="h-4 w-4 text-primary" />
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
      </div>

      {/* Children list */}
      {children.length > 0 ? (
        <div className="space-y-2">
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
        </div>
      ) : null}
    </div>
  );
}

// ── Tab: Equipment ─────────────────────────────────────────

function TabEquipment({ zoneId }: { zoneId: string }) {
  const { t } = useTranslation();
  const { data: equipmentData = [], isLoading } = useEquipmentByZone(zoneId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  if (equipmentData.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('zones.detail.equipment_empty')}</p>;
  }

  return (
    <ul className="space-y-1">
      {equipmentData.map((eq) => (
        <li key={eq.id}>
          <Link
            to={`/app/equipment/${eq.id}`}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span className="truncate">{eq.name}</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {eq.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── Tab: Tasks ─────────────────────────────────────────────

function TabTasks({ zoneId, navigate }: { zoneId: string; navigate: (to: string) => void }) {
  const { t } = useTranslation();
  const { data: tasksData, isLoading } = useZoneTasks(zoneId);
  const zoneTasks = tasksData?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/app/interactions/new?type=todo&zone_id=${zoneId}`)}
        >
          {t('zones.detail.add_task')}
        </Button>
      </div>
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
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {task.status}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tab: Activity ──────────────────────────────────────────

function TabActivity({ zoneId, navigate }: { zoneId: string; navigate: (to: string) => void }) {
  const { t } = useTranslation();
  const { data: activityData, isLoading } = useZoneActivity(zoneId);
  const zoneActivity = (activityData?.items ?? []).filter((item) => item.type !== 'todo');

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/app/interactions/new?zone_id=${zoneId}`)}
        >
          {t('zones.detail.add_activity')}
        </Button>
      </div>
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
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {item.type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tab: Projects ──────────────────────────────────────────

function TabProjects({ zoneId }: { zoneId: string }) {
  const { t } = useTranslation();
  const { data: projectsData = [], isLoading } = useZoneProjects(zoneId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  if (projectsData.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('zones.detail.projects_empty')}</p>;
  }

  return (
    <ul className="space-y-1">
      {projectsData.map((project) => (
        <li key={project.id}>
          <Link
            to={`/app/projects/${project.id}`}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span className="truncate">{project.title}</span>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {project.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── Tab: Photos ────────────────────────────────────────────

function TabPhotos({ zoneId }: { zoneId: string }) {
  const { t } = useTranslation();
  const { data: photos = [], isLoading } = useZonePhotos(zoneId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('zones.photos.empty')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((photo) => (
        <Link
          key={photo.id}
          to={`/app/documents/${photo.id}`}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
        >
          {photo.file_url ? (
            <img
              src={photo.file_url}
              alt={photo.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate text-xs text-white">{photo.name}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Tab: Documents ─────────────────────────────────────────

function TabDocuments({ zoneId }: { zoneId: string }) {
  const { t } = useTranslation();
  const { data: documents = [], isLoading } = useZoneDocuments(zoneId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('zones.detail.documents_empty')}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            to={`/app/documents/${doc.id}`}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{doc.name || doc.file_path.split('/').pop()}</span>
            </div>
            {doc.type ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {doc.type}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function ZoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = React.useState(false);

  const { data: zone, isLoading, error } = useZone(id ?? '');
  const { data: allZones = [] } = useZones();

  const children = React.useMemo(() => {
    if (!id) return [];
    return allZones.filter((z) => (z.parentId ?? z.parent) === id);
  }, [allZones, id]);

  const parentName = React.useMemo(() => {
    if (!zone) return null;
    const parentId = zone.parentId ?? zone.parent;
    if (!parentId) return null;
    const parent = allZones.find((z) => z.id === parentId);
    return parent?.name ?? null;
  }, [zone, allZones]);

  const parentId = zone?.parentId ?? zone?.parent ?? null;

  const { depthMap } = React.useMemo(() => buildZoneTree(allZones), [allZones]);

  const showSkeleton = useDelayedLoading(isLoading && !zone);

  if (!id) return null;

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (isLoading && !zone) return null;

  if (error || !zone) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
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
      <div className="space-y-4">
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
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            {t('zones.detail.edit')}
          </Button>
        </div>

        {/* Tabs */}
        <TabShell
          tabs={TABS.map((tab) => ({ key: tab, label: t(`zones.tabs.${tab}`) }))}
          sessionKey={`zone-detail.${zone.id}.tab`}
          defaultTab="info"
        >
          {(tab) => (
            <Card>
              <CardContent className="pt-4">
                {tab === 'info' ? (
                  <TabInfo
                    zone={zone}
                    parentId={parentId}
                    parentName={parentName}
                    children={children}
                    depthMap={depthMap}
                  />
                ) : null}

                {tab === 'equipment' ? <TabEquipment zoneId={id} /> : null}

                {tab === 'tasks' ? <TabTasks zoneId={id} navigate={navigate} /> : null}

                {tab === 'activity' ? <TabActivity zoneId={id} navigate={navigate} /> : null}

                {tab === 'projects' ? <TabProjects zoneId={id} /> : null}

                {tab === 'photos' ? <TabPhotos zoneId={id} /> : null}

                {tab === 'documents' ? <TabDocuments zoneId={id} /> : null}
              </CardContent>
            </Card>
          )}
        </TabShell>
      </div>

      <ZoneDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={zone}
      />
    </>
  );
}
