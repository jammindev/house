import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';

interface InteractionListProps {
  title?: string;
  type?: string;
  status?: string;
  limit?: number;
  householdId?: string;
  emptyMessage?: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-4/5" />
    </div>
  );
}

export function InteractionList({
  title = 'Latest interactions',
  type,
  status,
  limit = 8,
  householdId,
  emptyMessage = 'No interactions found for this filter.',
}: InteractionListProps) {
  const [items, setItems] = React.useState<InteractionListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchInteractions({
          type,
          status,
          limit,
          householdId,
        });

        if (isMounted) {
          setItems(data);
        }
      } catch {
        if (isMounted) {
          setError('Unable to load interactions.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [type, status, limit, householdId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingState /> : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>Loading error</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm">{item.subject}</p>
                  <Badge variant="outline">{item.type}</Badge>
                </div>
                {item.content ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
                ) : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatDate(item.occurred_at)}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default InteractionList;
