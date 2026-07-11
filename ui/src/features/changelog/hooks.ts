import { useQuery } from '@tanstack/react-query';

import { fetchChangelog, fetchChangelogState } from '@/lib/api/changelog';

export const changelogKeys = {
  all: ['changelog'] as const,
  list: () => [...changelogKeys.all, 'list'] as const,
  state: () => [...changelogKeys.all, 'state'] as const,
};

export function useChangelog() {
  return useQuery({
    queryKey: changelogKeys.list(),
    queryFn: fetchChangelog,
  });
}

export function useChangelogState() {
  return useQuery({
    queryKey: changelogKeys.state(),
    queryFn: fetchChangelogState,
  });
}
