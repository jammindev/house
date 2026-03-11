import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

interface ListPageEmptyConfig {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

interface ListPageProps {
  title: string;
  description?: string;
  /** Action buttons shown in the header only when the list is NOT empty */
  actions?: React.ReactNode;
  isEmpty: boolean;
  emptyState: ListPageEmptyConfig;
  /** List content including loading/error states — hidden when empty */
  children: React.ReactNode;
}

export default function ListPage({ title, description, actions, isEmpty, emptyState, children }: ListPageProps) {
  return (
    <>
      <PageHeader title={title} description={description}>
        {!isEmpty ? actions : null}
      </PageHeader>
      {isEmpty ? <EmptyState {...emptyState} /> : children}
    </>
  );
}
