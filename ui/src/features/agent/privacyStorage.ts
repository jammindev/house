const STORAGE_KEY = 'agent.privacyAccepted.v1';

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
