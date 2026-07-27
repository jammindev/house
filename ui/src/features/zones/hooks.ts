import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  fetchZones,
  fetchZone,
  createZone,
  updateZone,
  deleteZone,
  type Zone,
  type ZonePayload,
} from '@/lib/api/zones';
import { fetchEquipmentList } from '@/lib/api/equipment';
import { fetchInteractions } from '@/lib/api/interactions';
import { fetchTasks } from '@/lib/api/tasks';
import { fetchProjects } from '@/lib/api/projects';

export const zoneKeys = {
  all: ['zones'] as const,
  list: () => [...zoneKeys.all, 'list'] as const,
  detail: (id: string) => [...zoneKeys.all, 'detail', id] as const,
};

export function useZones() {
  return useQuery({
    queryKey: zoneKeys.list(),
    queryFn: fetchZones,
  });
}

export function useZone(id: string) {
  return useQuery({
    queryKey: zoneKeys.detail(id),
    queryFn: () => fetchZone(id),
    enabled: !!id,
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ZonePayload) => createZone(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: zoneKeys.all });
      toast({ description: t('zones.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ZonePayload> }) =>
      updateZone(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: zoneKeys.all });
      toast({ description: t('zones.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: zoneKeys.all }); },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({
        description: detail || t('zones.deleteFailed'),
        variant: 'destructive',
      });
    },
  });
}

// ── Zone-scoped data hooks ────────────────────────────────────────────────────

export const zoneEquipmentKeys = {
  byZone: (zoneId: string) => ['zones', 'equipment', zoneId] as const,
};

export const zoneInteractionKeys = {
  tasks: (zoneId: string) => ['zones', 'tasks', zoneId] as const,
  activity: (zoneId: string) => ['zones', 'activity', zoneId] as const,
};

export function useEquipmentByZone(zoneId: string) {
  return useQuery({
    queryKey: zoneEquipmentKeys.byZone(zoneId),
    queryFn: () => fetchEquipmentList({ zone: zoneId }),
    enabled: !!zoneId,
  });
}

export function useZoneTasks(zoneId: string) {
  return useQuery({
    queryKey: zoneInteractionKeys.tasks(zoneId),
    queryFn: async () => {
      const tasks = await fetchTasks({ zone: zoneId });
      return tasks.filter((task) => task.status !== 'done' && task.status !== 'archived').slice(0, 5);
    },
    enabled: !!zoneId,
  });
}

export function useZoneActivity(zoneId: string) {
  return useQuery({
    queryKey: zoneInteractionKeys.activity(zoneId),
    queryFn: () => fetchInteractions({ zone: zoneId, limit: 5 }),
    enabled: !!zoneId,
  });
}

export function useZoneProjects(zoneId: string) {
  return useQuery({
    queryKey: ['zones', zoneId, 'projects'],
    queryFn: () => fetchProjects({ zone: zoneId, status: 'active' }),
    enabled: !!zoneId,
  });
}

// ── Tree helpers (used by components) ────────────────────────────────────────

/**
 * Given a flat list of zones, compute a depth-first ordered list
 * (roots first, then children indented) along with a depth map.
 */
export function buildZoneTree(zones: Zone[]): {
  sortedZones: Zone[];
  depthMap: Map<string, number>;
} {
  if (zones.length === 0) return { sortedZones: [], depthMap: new Map() };

  const byId = new Map<string, Zone>();
  const childrenByParent = new Map<string | null, Zone[]>();

  for (const zone of zones) {
    byId.set(zone.id, zone);
  }

  for (const zone of zones) {
    const parentId = zone.parentId ?? zone.parent ?? null;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(zone);
    childrenByParent.set(parentId, list);
  }

  // Sort each group alphabetically
  childrenByParent.forEach((list) =>
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  );

  const depthMap = new Map<string, number>();
  const sortedZones: Zone[] = [];
  const visited = new Set<string>();

  const visit = (zone: Zone, depth: number) => {
    if (visited.has(zone.id)) return;
    visited.add(zone.id);
    depthMap.set(zone.id, depth);
    sortedZones.push(zone);
    const children = childrenByParent.get(zone.id) ?? [];
    for (const child of children) visit(child, depth + 1);
  };

  const roots = (childrenByParent.get(null) ?? []).slice().sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  for (const root of roots) visit(root, 0);

  // Handle orphans (parent missing from list)
  for (const zone of zones) {
    if (!visited.has(zone.id)) visit(zone, 0);
  }

  return { sortedZones, depthMap };
}

// ── Dense tree rows (ZonesPage) ──────────────────────────────────────────────

/** Une ligne de l'arborescence dense, prête à rendre. */
export interface ZoneTreeRow {
  zone: Zone;
  depth: number;
  /** La zone a au moins un enfant *dans l'arbre courant* (recherche comprise). */
  hasChildren: boolean;
  /** Dernière de ses frères — la branche de gauche s'arrête à cette ligne. */
  isLast: boolean;
  /**
   * Pour chaque niveau d'ancêtre (0 → depth-1) : cet ancêtre a-t-il encore un
   * frère après lui ? Détermine si le trait vertical du guide continue à ce
   * niveau. Sans ça les indentations profondes deviennent illisibles.
   */
  guides: boolean[];
}

function groupByParent(zones: Zone[]): Map<string | null, Zone[]> {
  const byParent = new Map<string | null, Zone[]>();
  for (const zone of zones) {
    const parentId = zone.parentId ?? zone.parent ?? null;
    const list = byParent.get(parentId) ?? [];
    list.push(zone);
    byParent.set(parentId, list);
  }
  byParent.forEach((list) =>
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  );
  return byParent;
}

function normalizeQuery(value: string): string {
  // Insensible à la casse *et* aux accents : « etage » doit trouver « Étage ».
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Restreint l'arbre aux zones qui répondent à la recherche : les zones qui
 * correspondent, **leurs ancêtres** (sinon le résultat flotterait hors de sa
 * hiérarchie) et **leurs descendants** (sinon un parent trouvé s'afficherait
 * comme une feuille alors qu'il a du contenu).
 */
function visibleForQuery(zones: Zone[], query: string): Set<string> {
  const needle = normalizeQuery(query);
  // Type explicite : `zones.map(z => [z.id, z])` s'infère en `(string | Zone)[][]`,
  // ce qui donnerait une Map<string | Zone, …> et rendrait la remontée d'ancêtres
  // circulaire pour le compilateur.
  const byId = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const byParent = groupByParent(zones);

  const matched = zones.filter((z) => normalizeQuery(z.name).includes(needle));
  const visible = new Set<string>();

  for (const zone of matched) {
    // Ancêtres
    let current: Zone | undefined = zone;
    while (current && !visible.has(current.id)) {
      visible.add(current.id);
      // Annotation explicite : `current` est réaffecté depuis une valeur dérivée
      // de lui-même, ce que TS lit comme une initialisation circulaire (TS7022).
      const parentId: string | null = current.parentId ?? current.parent ?? null;
      current = parentId ? byId.get(parentId) : undefined;
    }
    // Descendants
    const queue = [zone.id];
    while (queue.length > 0) {
      const currentId = queue.pop()!;
      for (const child of byParent.get(currentId) ?? []) {
        if (visible.has(child.id)) continue;
        visible.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return visible;
}

/**
 * Ids des zones qui ont au moins un enfant — les seules qui portent un chevron.
 *
 * Calculé sur l'arbre **complet**, indépendamment du pliage et de la recherche :
 * « Replier tout » doit refermer les branches qu'un filtre masque à l'instant T,
 * sinon l'état de pliage dépendrait de ce qui était affiché au moment du clic.
 */
export function expandableZoneIds(zones: Zone[]): string[] {
  const parentIds = new Set<string>();
  for (const zone of zones) {
    const parentId = zone.parentId ?? zone.parent ?? null;
    if (parentId) parentIds.add(parentId);
  }
  return zones.filter((zone) => parentIds.has(zone.id)).map((zone) => zone.id);
}

/**
 * Aplatit les zones en lignes d'arborescence rendues telles quelles par la page.
 *
 * Une recherche active **ignore le pliage** : un résultat qu'il faut déplier
 * pour voir n'est pas un résultat.
 */
export function buildZoneRows(
  zones: Zone[],
  options: { collapsed?: ReadonlySet<string>; query?: string } = {}
): { rows: ZoneTreeRow[]; matchCount: number } {
  const query = options.query?.trim() ?? '';
  const isSearching = query.length > 0;
  const allowed = isSearching ? visibleForQuery(zones, query) : null;
  const pool = allowed ? zones.filter((z) => allowed.has(z.id)) : zones;

  if (pool.length === 0) return { rows: [], matchCount: 0 };

  const byParent = groupByParent(pool);
  const present = new Set(pool.map((z) => z.id));
  const collapsed = isSearching ? new Set<string>() : (options.collapsed ?? new Set<string>());

  const rows: ZoneTreeRow[] = [];
  const seen = new Set<string>();

  /**
   * Marque tout un sous-arbre comme visité sans émettre de ligne.
   *
   * Indispensable au pliage : le filet à orphelins en fin de fonction repêche
   * tout ce qui n'a pas été vu, donc sans ce marquage il **réinjectait au
   * niveau 0** les enfants qu'un pliage venait d'écarter — replier ne masquait
   * rien, ça descendait les enfants en bas de la liste, désindentés.
   */
  const markSubtree = (zoneId: string) => {
    const queue = [zoneId];
    while (queue.length > 0) {
      const currentId = queue.pop()!;
      for (const child of byParent.get(currentId) ?? []) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        queue.push(child.id);
      }
    }
  };

  const walk = (zone: Zone, depth: number, isLast: boolean, guides: boolean[]) => {
    if (seen.has(zone.id)) return;
    seen.add(zone.id);

    const children = byParent.get(zone.id) ?? [];
    const hasChildren = children.length > 0;

    rows.push({ zone, depth, hasChildren, isLast, guides });

    if (!hasChildren) return;
    if (collapsed.has(zone.id)) {
      markSubtree(zone.id);
      return;
    }
    const childGuides = [...guides, !isLast];
    children.forEach((child, index) =>
      walk(child, depth + 1, index === children.length - 1, childGuides)
    );
  };

  // Racines de l'arbre affiché : les zones dont le parent est absent du pool
  // (vraie racine du foyer, ou parent filtré par la recherche / introuvable).
  const roots = pool
    .filter((zone) => {
      const parentId = zone.parentId ?? zone.parent ?? null;
      return !parentId || !present.has(parentId);
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  roots.forEach((root, index) => walk(root, 0, index === roots.length - 1, []));

  // Filet à orphelins : une zone rendue inatteignable par un cycle de parenté
  // doit rester affichée plutôt que disparaître en silence. Les sous-arbres
  // repliés sont déjà marqués `seen`, ils ne passent donc pas par ici.
  for (const zone of pool) {
    if (!seen.has(zone.id)) walk(zone, 0, true, []);
  }

  const needle = normalizeQuery(query);
  const matchCount = isSearching
    ? zones.filter((z) => normalizeQuery(z.name).includes(needle)).length
    : rows.length;

  return { rows, matchCount };
}

/**
 * Returns the set of zone ids that are descendants of `zoneId` (inclusive).
 */
export function getDescendantIds(zoneId: string, zones: Zone[]): Set<string> {
  const childrenByParent = new Map<string, Zone[]>();
  for (const zone of zones) {
    const pid = zone.parentId ?? zone.parent ?? null;
    if (!pid) continue;
    const list = childrenByParent.get(pid) ?? [];
    list.push(zone);
    childrenByParent.set(pid, list);
  }

  const result = new Set<string>([zoneId]);
  const queue = [zoneId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      result.add(child.id);
      queue.push(child.id);
    }
  }
  return result;
}
