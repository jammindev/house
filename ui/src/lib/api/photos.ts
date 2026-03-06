export interface PhotoDocument {
  id: string;
  name: string;
  notes?: string | null;
  mime_type: string;
  file_path: string;
  file_url: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  created_by_name?: string | null;
}

function buildHeaders(householdId?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(householdId ? { 'X-Household-Id': householdId } : {}),
  };
}

export async function fetchPhotos(householdId?: string | null): Promise<PhotoDocument[]> {
  const res = await fetch(
    '/api/documents/documents/?type=photo&ordering=-created_at',
    { headers: buildHeaders(householdId) },
  );
  if (!res.ok) throw new Error(`Failed to fetch photos: ${res.status}`);
  const data = await res.json() as unknown;
  return Array.isArray(data)
    ? (data as PhotoDocument[])
    : ((data as { results?: PhotoDocument[] }).results ?? []);
}
