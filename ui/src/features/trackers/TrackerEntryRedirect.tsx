import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/axios';
import type { TrackerEntry } from '@/lib/api/trackers';

/**
 * `/app/tracker-entries/:id` → the parent tracker's page.
 *
 * Entries have no page of their own, but the agent's citations and undo toasts
 * link created entries by their own id (`url_template` formats with the created
 * instance's pk). This route resolves the entry and forwards to its tracker.
 */
export default function TrackerEntryRedirect() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data: entry, isError } = useQuery({
    queryKey: ['tracker-entry-redirect', id],
    queryFn: async (): Promise<TrackerEntry> => {
      const res = await api.get(`/trackers/entries/${id}/`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  React.useEffect(() => {
    if (entry) navigate(`/app/trackers/${entry.tracker}`, { replace: true });
    else if (isError) navigate('/app/trackers', { replace: true });
  }, [entry, isError, navigate]);

  return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
