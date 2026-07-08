import * as React from 'react';
import { Brain, Check, Pencil, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { Textarea } from '@/design-system/textarea';
import BackLink from '@/components/BackLink';
import CardActions, { type CardAction } from '@/components/CardActions';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import type { AgentMemory } from './api';
import { agentKeys, useClearMemories, useDeleteMemory, useMemories, useUpdateMemory } from './hooks';

/**
 * "What the agent knows about me" — list + edit + delete (with undo) + clear all
 * of the current user's agent memories. Memories are private per (household,
 * user); they are captured from chat (or via "remember that…") and injected
 * into the agent's answers. This page is the transparency + control surface.
 */
export default function MemoryPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: memories = [], isLoading } = useMemories();
  const deleteMemory = useDeleteMemory();
  const clearMemories = useClearMemories();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('agent.memory.deleted'),
    onDelete: (id: string) => deleteMemory.mutateAsync(id),
  });

  const removeFromCache = (id: string) =>
    qc.setQueryData<AgentMemory[]>(agentKeys.memories(), (old) =>
      old?.filter((m) => m.id !== id),
    );
  const restoreToCache = (memory: AgentMemory) =>
    qc.setQueryData<AgentMemory[]>(agentKeys.memories(), (old) =>
      old ? [memory, ...old.filter((m) => m.id !== memory.id)] : [memory],
    );

  const showSkeleton = useDelayedLoading(isLoading);
  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink fallback="/app/settings" fallbackLabel={t('settings.title')} />
      <PageHeader title={t('agent.memory.title')} description={t('agent.memory.description')}>
        {memories.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setConfirmClearOpen(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t('agent.memory.clearAll')}
          </Button>
        ) : null}
      </PageHeader>

      {memories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={t('agent.memory.emptyTitle')}
          description={t('agent.memory.emptyDescription')}
        />
      ) : (
        <div className="space-y-2">
          {memories.map((memory) =>
            editingId === memory.id ? (
              <MemoryEditor
                key={memory.id}
                memory={memory}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onEdit={() => setEditingId(memory.id)}
                onDelete={() =>
                  deleteWithUndo(memory.id, {
                    onRemove: () => removeFromCache(memory.id),
                    onRestore: () => restoreToCache(memory),
                  })
                }
              />
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title={t('agent.memory.clearConfirmTitle')}
        description={t('agent.memory.clearConfirmDescription')}
        confirmLabel={t('agent.memory.clearAll')}
        loading={clearMemories.isPending}
        onConfirm={() => {
          void clearMemories.mutateAsync().then(() => setConfirmClearOpen(false));
        }}
      />
    </div>
  );
}

function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: AgentMemory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground">
          {memory.content}
        </p>
        <CardActions actions={actions} />
      </div>
    </Card>
  );
}

function MemoryEditor({ memory, onDone }: { memory: AgentMemory; onDone: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(memory.content);
  const updateMemory = useUpdateMemory();

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === memory.content) {
      onDone();
      return;
    }
    void updateMemory.mutateAsync({ id: memory.id, content: trimmed }).then(onDone);
  };

  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          autoFocus
          maxLength={500}
          className="min-h-0 flex-1 resize-none"
          aria-label={t('agent.memory.editLabel')}
        />
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            onClick={save}
            disabled={updateMemory.isPending}
            aria-label={t('common.save')}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDone}
            disabled={updateMemory.isPending}
            aria-label={t('common.cancel')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
