export interface ZoneOption {
  id: string;
  name: string;
  full_path?: string;
  color?: string;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

function normalizeList(payload: unknown): ZoneOption[] {
  if (Array.isArray(payload)) {
    return payload as ZoneOption[];
  }

  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<ZoneOption>;
    if (Array.isArray(paginated.results)) {
      return paginated.results;
    }
  }

  return [];
}

export async function fetchZones(householdId?: string): Promise<ZoneOption[]> {
  const response = await fetch('/api/zones/', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(householdId ? { 'X-Household-Id': householdId } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeList(payload);
}
