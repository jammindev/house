// v2: the notice's retention claim changed (conversations ARE persisted since
// the conversational-memory lot) — bumping the key re-surfaces it once.
const STORAGE_KEY = 'agent.privacyAccepted.v2';

export function hasAcceptedAgentPrivacy(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function acceptAgentPrivacy(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // ignore — best-effort
  }
}
