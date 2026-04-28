import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'app:chunkReloadAt';
const RELOAD_COOLDOWN_MS = 30_000;

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  return (
    err.name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Loading chunk')
  );
}

export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
      if (Date.now() - last < RELOAD_COOLDOWN_MS) throw err;

      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return new Promise<{ default: T }>(() => {});
    }
  });
}
