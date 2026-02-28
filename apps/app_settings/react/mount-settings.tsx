import { StrictMode, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { onDomReady } from '@/lib/mount'; // also initializes i18n as a side-effect

import UserSettings from './UserSettings';
import type { UserProfile } from '@/lib/api/users';
import type { Household } from '@/lib/api/households';

function readJsonScript<T>(id: string, fallback: T): T {
  const el = document.getElementById(id);
  if (!el?.textContent) return fallback;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return fallback;
  }
}

onDomReady(() => {
  const mountNode = document.getElementById('settings-root');
  if (!mountNode) return;

  const initialUser = readJsonScript<UserProfile | null>('settings-initial-user', null);
  const initialHouseholds = readJsonScript<Household[]>('settings-initial-households', []);

  if (!initialUser) {
    console.error('settings-initial-user script not found');
    return;
  }

  const root = createRoot(mountNode);
  root.render(
    <StrictMode>
      {createElement(UserSettings, { initialUser, initialHouseholds })}
    </StrictMode>
  );
});
