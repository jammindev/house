import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/axios';

interface Props {
  /** The API collection holding the entry — also the URL segment. */
  kind: 'events' | 'harvests';
}

/**
 * `/app/orchard/events/:id` and `/app/orchard/harvests/:id` → the subject's page.
 *
 * Journal entries and harvests have no page of their own, yet the agent cites
 * them and the palette lists them **by their own id** (`url_template` formats
 * with the instance's pk). They used to borrow the subject's template,
 * `/app/orchard/{id}`, which loads a `Tree` by that id: the page found nothing
 * and rendered blank.
 *
 * The alternative — a decorative `?event=` on the list, as `chickens` does — was
 * rejected: a parameter that pilots nothing gets copied into a bookmark while
 * promising the opposite. Same reasoning as `TrackerEntryRedirect`, which solved
 * this exact problem first.
 */
export default function TreeEntryRedirect({ kind }: Props) {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data: entry, isError } = useQuery({
    queryKey: ['orchard-entry-redirect', kind, id],
    queryFn: async (): Promise<{ tree: string }> => {
      const res = await api.get(`/orchard/${kind}/${id}/`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  React.useEffect(() => {
    // A deleted entry falls back to the orchard rather than to a dead end: the
    // link is old, not wrong.
    if (entry) navigate(`/app/orchard/${entry.tree}`, { replace: true });
    else if (isError) navigate('/app/orchard', { replace: true });
  }, [entry, isError, navigate]);

  return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
