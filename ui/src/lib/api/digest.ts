import { api } from '@/lib/axios';

/** One rendered block of the daily digest (title + a few localized lines). */
export interface DigestSection {
  key: string;
  emoji: string;
  title: string;
  lines: string[];
}

/** A section that exists for this household (module enabled), for the toggles. */
export interface AvailableSection {
  key: string;
  module: string | null;
}

export interface DigestPreview {
  /** Local date the digest was composed for (ISO). */
  generated_on: string;
  sections: DigestSection[];
  available_sections: AvailableSection[];
  disabled_sections: string[];
}

/** Today's composed digest for the current user, computed on demand. */
export async function fetchDigest(): Promise<DigestPreview> {
  const { data } = await api.get<DigestPreview>('/agent/digest/');
  return data;
}
