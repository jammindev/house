/**
 * Maps the current app route to the agent entity it anchors on, so the global
 * assistant launcher can open pre-anchored on whatever detail page you're on.
 *
 * The URL segment isn't always the agent `entity_type` (e.g. `/app/stock/:id`
 * anchors on `stock_item`), hence the explicit map. Only the 8 detail routes
 * that back an agent-searchable entity are listed; every other route (lists,
 * `/new`, `/edit`, `tracker-entries`, `interactions`, admin…) resolves to null
 * → the launcher falls back to the household-wide conversation.
 */

/** URL segment (`/app/<segment>/<id>`) → agent entity_type. */
const ROUTE_ENTITY_MAP: Record<string, string> = {
  projects: 'project',
  zones: 'zone',
  tasks: 'task',
  trackers: 'tracker',
  chickens: 'chicken',
  documents: 'document',
  stock: 'stock_item',
  equipment: 'equipment',
};

export interface EntityContext {
  entityType: string;
  objectId: string;
}

/**
 * Resolve `{ entityType, objectId }` from a pathname, or null when the route
 * isn't an anchorable entity detail page. Matches strictly `/app/<seg>/<id>`
 * (no trailing sub-path), so `/app/tasks/:id/edit` or `/app/agent/memory`
 * don't accidentally anchor.
 */
export function resolveEntityContext(pathname: string): EntityContext | null {
  const match = pathname.match(/^\/app\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  const [, segment, objectId] = match;
  const entityType = ROUTE_ENTITY_MAP[segment];
  if (!entityType || objectId === 'new') return null;
  return { entityType, objectId };
}
