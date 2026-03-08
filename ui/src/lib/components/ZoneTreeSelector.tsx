import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/design-system/input';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';
import { cn } from '@/lib/utils';

interface ZoneTreeNode {
  zone: ZoneOption;
  children: ZoneTreeNode[];
  parentId: string | null;
}

interface ZoneTreeSelectorProps {
  householdId?: string;
  selectedZoneIds: string[];
  onChange: (zoneIds: string[]) => void;
  initialZones?: ZoneOption[];
  initialZonesLoaded?: boolean;
  storageKey?: string;
  legend?: string;
}

const DEFAULT_STORAGE_KEY = 'zone-tree-selector:expanded-zones';

function getZoneDepth(zone: ZoneOption): number {
  if (typeof zone.depth === 'number') {
    return zone.depth;
  }

  if (!zone.full_path) {
    return 0;
  }

  return Math.max(0, zone.full_path.split(' / ').length - 1);
}

function getZonePathParts(zone: ZoneOption): string[] {
  const path = zone.full_path || zone.name;
  return path.split(' / ').filter(Boolean);
}

function buildZoneTree(zones: ZoneOption[]) {
  const sortedZones = [...zones].sort((left, right) => {
    const leftPath = left.full_path || left.name;
    const rightPath = right.full_path || right.name;
    return leftPath.localeCompare(rightPath);
  });

  const nodesById = new Map<string, ZoneTreeNode>();

  for (const zone of sortedZones) {
    nodesById.set(zone.id, { zone, children: [], parentId: null });
  }

  const roots: ZoneTreeNode[] = [];

  for (const zone of sortedZones) {
    const currentNode = nodesById.get(zone.id);

    if (!currentNode) {
      continue;
    }

    if (!zone.parentId) {
      roots.push(currentNode);
      continue;
    }

    const parentNode = nodesById.get(zone.parentId);
    if (!parentNode) {
      roots.push(currentNode);
      continue;
    }

    currentNode.parentId = zone.parentId;
    parentNode.children.push(currentNode);
  }

  return { roots, nodesById };
}

function readPersistedExpandedZoneIds(storageKey: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function ZoneTreeSelector({
  householdId,
  selectedZoneIds,
  onChange,
  initialZones = [],
  initialZonesLoaded = false,
  storageKey = DEFAULT_STORAGE_KEY,
  legend,
}: ZoneTreeSelectorProps) {
  const { t } = useTranslation();
  const resolvedLegend = legend ?? t('interactions.zones_legend');
  const [zones, setZones] = React.useState<ZoneOption[]>(initialZones);
  const [zonesLoading, setZonesLoading] = React.useState(!initialZonesLoaded);
  const [zonesError, setZonesError] = React.useState<string | null>(null);
  const [zoneSearch, setZoneSearch] = React.useState('');
  const [expandedZoneIds, setExpandedZoneIds] = React.useState<string[]>(() => readPersistedExpandedZoneIds(storageKey));

  const normalizedZoneSearch = zoneSearch.trim().toLowerCase();
  const { roots: zoneTreeRoots, nodesById } = React.useMemo(() => buildZoneTree(zones), [zones]);
  const visibleZones = React.useMemo(
    () =>
      [...zones]
        .sort((left, right) => {
          const leftPath = left.full_path || left.name;
          const rightPath = right.full_path || right.name;
          return leftPath.localeCompare(rightPath);
        })
        .filter((zone) => {
          if (!normalizedZoneSearch) {
            return true;
          }

          const haystack = `${zone.full_path || ''} ${zone.name}`.toLowerCase();
          return haystack.includes(normalizedZoneSearch);
        }),
    [zones, normalizedZoneSearch]
  );
  const selectedZones = React.useMemo(
    () => zones.filter((zone) => selectedZoneIds.includes(zone.id)),
    [zones, selectedZoneIds]
  );
  const branchZoneIds = React.useMemo(
    () => Array.from(nodesById.values()).filter((node) => node.children.length > 0).map((node) => node.zone.id),
    [nodesById]
  );

  React.useEffect(() => {
    if (initialZonesLoaded) {
      setZones(initialZones);
      setZonesLoading(false);
      setZonesError(null);
      return;
    }

    let isMounted = true;

    async function loadZones() {
      setZonesLoading(true);
      setZonesError(null);

      try {
        const data = await fetchZones(householdId);
        if (isMounted) {
          setZones(data);
        }
      } catch {
        if (isMounted) {
          setZonesError(t('interactions.zones_error'));
        }
      } finally {
        if (isMounted) {
          setZonesLoading(false);
        }
      }
    }

    loadZones();

    return () => {
      isMounted = false;
    };
  }, [householdId, initialZones, initialZonesLoaded, t]);

  React.useEffect(() => {
    setExpandedZoneIds((previous) => {
      const nextExpanded = new Set(previous.filter((zoneId) => nodesById.has(zoneId)));

      for (const selectedZoneId of selectedZoneIds) {
        let currentNode = nodesById.get(selectedZoneId);
        nextExpanded.add(selectedZoneId);
        while (currentNode?.parentId) {
          nextExpanded.add(currentNode.parentId);
          currentNode = nodesById.get(currentNode.parentId);
        }
      }

      const resolved = Array.from(nextExpanded);
      if (resolved.length === previous.length && resolved.every((zoneId) => previous.includes(zoneId))) {
        return previous;
      }

      return resolved;
    });
  }, [nodesById, selectedZoneIds]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(expandedZoneIds));
  }, [expandedZoneIds, storageKey]);

  function toggleZone(zoneId: string) {
    onChange(
      selectedZoneIds.includes(zoneId)
        ? selectedZoneIds.filter((id) => id !== zoneId)
        : [...selectedZoneIds, zoneId]
    );
  }

  function toggleBranch(zoneId: string) {
    setExpandedZoneIds((previous) =>
      previous.includes(zoneId) ? previous.filter((id) => id !== zoneId) : [...previous, zoneId]
    );
  }

  function expandAllBranches() {
    setExpandedZoneIds(branchZoneIds);
  }

  function collapseAllBranches() {
    setExpandedZoneIds([]);
  }

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium">{resolvedLegend}</legend>
        {selectedZones.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('interactions.zones_selected_count', { count: selectedZones.length })}
          </span>
        ) : null}
      </div>

      {zonesLoading ? <p className="text-xs text-muted-foreground">{t('interactions.zones_loading')}</p> : null}
      {zonesError ? <p className="text-xs text-destructive">{zonesError}</p> : null}

      {!zonesLoading && !zonesError && zones.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('interactions.zones_empty')}</p>
      ) : null}

      {!zonesLoading && !zonesError && zones.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="zone-tree-selector-search" className="text-xs font-medium text-muted-foreground">
              {t('interactions.zones_search_label')}
            </label>
            <Input
              id="zone-tree-selector-search"
              value={zoneSearch}
              onChange={(event) => setZoneSearch(event.target.value)}
              placeholder={t('interactions.zones_search_placeholder')}
            />
          </div>

          {!normalizedZoneSearch && branchZoneIds.length > 0 ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={collapseAllBranches}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('interactions.zones_collapse_all')}
              </button>
              <button
                type="button"
                onClick={expandAllBranches}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('interactions.zones_expand_all')}
              </button>
            </div>
          ) : null}

          {selectedZones.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedZones.map((zone) => (
                <button
                  key={`selected-${zone.id}`}
                  type="button"
                  onClick={() => toggleZone(zone.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/15"
                >
                  <span className="h-2 w-2 rounded-full border border-background/80" style={{ backgroundColor: zone.color || '#cbd5e1' }} />
                  <span>{zone.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          {visibleZones.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('interactions.zones_search_empty')}</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-background/70 p-2">
              {normalizedZoneSearch
                ? visibleZones.map((zone) => {
                    const selected = selectedZoneIds.includes(zone.id);
                    const depth = getZoneDepth(zone);
                    const pathParts = getZonePathParts(zone);
                    const parentPath = pathParts.slice(0, -1).join(' / ');
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => toggleZone(zone.id)}
                        aria-pressed={selected}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border/70 bg-background hover:border-border hover:bg-muted/30'
                        )}
                        style={{ marginLeft: depth ? Math.min(depth * 18, 54) : 0 }}
                      >
                        <span
                          className={cn(
                            'h-2.5 w-2.5 shrink-0 rounded-full border border-background/80',
                            selected ? 'ring-2 ring-primary/20' : ''
                          )}
                          style={{ backgroundColor: zone.color || '#cbd5e1' }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{zone.name}</span>
                          {parentPath ? (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {t('interactions.zones_parent_path_label')}: {parentPath}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                : zoneTreeRoots.map((node) => {
                    const renderNode = (treeNode: ZoneTreeNode): React.ReactNode => {
                      const zone = treeNode.zone;
                      const selected = selectedZoneIds.includes(zone.id);
                      const depth = getZoneDepth(zone);
                      const isExpanded = expandedZoneIds.includes(zone.id);
                      const hasChildren = treeNode.children.length > 0;
                      const pathParts = getZonePathParts(zone);
                      const parentPath = pathParts.slice(0, -1).join(' / ');

                      return (
                        <div key={zone.id} className="space-y-1">
                          <div className="flex items-center gap-1" style={{ marginLeft: depth ? Math.min(depth * 18, 54) : 0 }}>
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleBranch(zone.id)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={
                                  isExpanded
                                    ? t('interactions.zones_collapse_branch', { name: zone.name })
                                    : t('interactions.zones_expand_branch', { name: zone.name })
                                }
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            ) : (
                              <span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/50">·</span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (hasChildren) {
                                  toggleBranch(zone.id);
                                  return;
                                }

                                toggleZone(zone.id);
                              }}
                              aria-expanded={hasChildren ? isExpanded : undefined}
                              aria-pressed={!hasChildren ? selected : undefined}
                              className={cn(
                                'flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
                                selected
                                  ? 'border-primary bg-primary/10 shadow-sm'
                                  : 'border-border/70 bg-background hover:border-border hover:bg-muted/30'
                              )}
                            >
                              <span
                                className={cn(
                                  'h-2.5 w-2.5 shrink-0 rounded-full border border-background/80',
                                  selected ? 'ring-2 ring-primary/20' : ''
                                )}
                                style={{ backgroundColor: zone.color || '#cbd5e1' }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{zone.name}</span>
                                {parentPath ? (
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {t('interactions.zones_parent_path_label')}: {parentPath}
                                  </span>
                                ) : null}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleZone(zone.id)}
                              aria-pressed={selected}
                              aria-label={
                                selected
                                  ? t('interactions.zones_unselect_zone', { name: zone.name })
                                  : t('interactions.zones_select_zone', { name: zone.name })
                              }
                              className={cn(
                                'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-2 text-[11px] font-medium transition-colors',
                                selected
                                  ? 'border-primary bg-primary/10 text-foreground hover:bg-primary/15'
                                  : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                              )}
                            >
                              {selected ? t('interactions.zones_selected_short') : t('interactions.zones_select_short')}
                            </button>
                          </div>

                          {hasChildren && isExpanded ? treeNode.children.map((child) => renderNode(child)) : null}
                        </div>
                      );
                    };

                    return renderNode(node);
                  })}
            </div>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}

export default ZoneTreeSelector;