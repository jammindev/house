import { useQuery } from '@tanstack/react-query';

import { fetchDigest, type DigestPreview } from '@/lib/api/digest';

export const digestKeys = {
  all: ['digest'] as const,
  preview: () => [...digestKeys.all, 'preview'] as const,
};

/** Today's composed digest for the current user (computed on demand server-side). */
export function useDigest() {
  return useQuery<DigestPreview>({
    queryKey: digestKeys.preview(),
    queryFn: fetchDigest,
  });
}

/** Delivery config (enable + send time) lives on the shared 'daily_digest' ping. */
export const DIGEST_PING_TYPE = 'daily_digest';
