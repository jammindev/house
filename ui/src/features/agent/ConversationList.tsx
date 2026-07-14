import * as React from 'react';
import { Plus, Pencil, Trash2, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { SheetDialog } from '@/design-system/sheet-dialog';
import CardActions, { type CardAction } from '@/components/CardActions';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { cn } from '@/lib/utils';
import { agentKeys, useConversations, useRenameConversation } from './hooks';
import { deleteConversation, type AgentConversationRow } from './api';

interface Props {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Called when the currently-open conversation is deleted. */
  onCurrentDeleted: () => void;
}

/** Recency bucket keys, newest first — drive the i18n group headers. */
type Bucket = 'today' | 'yesterday' | 'last7' | 'last30' | 'older';

/** Which recency bucket a conversation falls in, by its last activity. */
function bucketOf(conv: AgentConversationRow): Bucket {
  const ts = new Date(conv.last_message_at ?? conv.created_at).getTime();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (ts >= startOfToday) return 'today';
  if (ts >= startOfToday - day) return 'yesterday';
  if (ts >= startOfToday - 7 * day) return 'last7';
  if (ts >= startOfToday - 30 * day) return 'last30';
  return 'older';
}

/**
 * Group the (already recency-sorted) rows into consecutive buckets. Relies on
 * the server order — we never re-sort, just split at bucket boundaries.
 */
function groupByBucket(items: AgentConversationRow[]): { bucket: Bucket; rows: AgentConversationRow[] }[] {
  const groups: { bucket: Bucket; rows: AgentConversationRow[] }[] = [];
  for (const conv of items) {
    const bucket = bucketOf(conv);
    const last = groups[groups.length - 1];
    if (last && last.bucket === bucket) last.rows.push(conv);
    else groups.push({ bucket, rows: [conv] });
  }
  return groups;
}

export default function ConversationList({ currentId, onSelect, onNew, onCurrentDeleted }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: conversations } = useConversations();
  const rename = useRenameConversation();

  const [renaming, setRenaming] = React.useState<AgentConversationRow | null>(null);
  const [renameTitle, setRenameTitle] = React.useState('');

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('agent.deleted'),
    onDelete: (id) => deleteConversation(id),
  });

  const handleDelete = (conv: AgentConversationRow) => {
    deleteWithUndo(conv.id, {
      onRemove: () =>
        qc.setQueryData<AgentConversationRow[]>(agentKeys.conversations(), (old) =>
          (old ?? []).filter((c) => c.id !== conv.id),
        ),
      onRestore: () => void qc.invalidateQueries({ queryKey: agentKeys.conversations() }),
    });
    if (conv.id === currentId) onCurrentDeleted();
  };

  const openRename = (conv: AgentConversationRow) => {
    setRenaming(conv);
    setRenameTitle(conv.title);
  };

  const submitRename = () => {
    if (!renaming) return;
    const title = renameTitle.trim();
    if (title) rename.mutate({ id: renaming.id, title });
    setRenaming(null);
  };

  const items = conversations ?? [];
  const groups = groupByBucket(items);

  const renderRow = (conv: AgentConversationRow) => {
    const active = conv.id === currentId;
    const actions: CardAction[] = [
      { label: t('common.edit'), icon: Pencil, onClick: () => openRename(conv) },
      {
        label: t('common.delete'),
        icon: Trash2,
        onClick: () => handleDelete(conv),
        variant: 'danger',
      },
    ];
    return (
      <div
        key={conv.id}
        className={cn(
          'group flex items-center gap-1 rounded-lg px-1',
          active ? 'bg-primary/10' : 'hover:bg-muted',
        )}
        data-testid="agent-conversation-item"
      >
        <button
          type="button"
          onClick={() => onSelect(conv.id)}
          className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2 text-left"
        >
          <span
            className={cn(
              'flex items-center gap-2 text-sm',
              active ? 'text-primary' : 'text-foreground',
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{conv.title || t('agent.untitled')}</span>
          </span>
          {conv.last_message_preview ? (
            <span className="truncate pl-[1.375rem] text-xs text-muted-foreground">
              {conv.last_message_preview}
            </span>
          ) : null}
        </button>
        <CardActions actions={actions} />
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Button
        onClick={onNew}
        variant="outline"
        className="w-full justify-start gap-2"
        data-testid="agent-new-conversation"
      >
        <Plus className="h-4 w-4" />
        {t('agent.new_conversation')}
      </Button>

      <div
        className="min-h-0 flex-1 space-y-1 overflow-y-auto"
        data-testid="agent-conversation-list"
      >
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('agent.conversations_empty')}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.bucket} className="space-y-1">
              <p className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`agent.groups.${group.bucket}`)}
              </p>
              {group.rows.map(renderRow)}
            </div>
          ))
        )}
      </div>

      <SheetDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        title={t('agent.rename_title')}
      >
        <Input
          value={renameTitle}
          onChange={(e) => setRenameTitle(e.target.value)}
          placeholder={t('agent.rename_placeholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitRename();
            }
          }}
          autoFocus
          data-testid="agent-rename-input"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setRenaming(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submitRename} data-testid="agent-rename-save">
            {t('common.save')}
          </Button>
        </div>
      </SheetDialog>
    </div>
  );
}
