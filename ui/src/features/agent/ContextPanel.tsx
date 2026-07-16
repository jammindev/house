import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { pushBack } from '@/lib/backNavigation';
import { useSessionState } from '@/lib/useSessionState';
import { ENTITY_ICONS, ENTITY_ICON_FALLBACK } from './entityIcons';
import { usePinContext, useUnpinContext } from './hooks';
import AddContextDialog from './AddContextDialog';
import type { AgentContextItem, AgentConversationDetail, AgentSearchResult } from './api';

interface Props {
  conversation: AgentConversationDetail;
  /** Cache slot holding this conversation — pin/unpin write the refreshed detail here. */
  queryKey: readonly unknown[];
}

const itemKey = (i: { entity_type: string; object_id: string }) =>
  `${i.entity_type}:${i.object_id}`;

/**
 * "What I know" panel shown above the entity-anchored chat: makes the agent's
 * pre-injected context visible (anchor + linked items) and lets the user pin
 * extra entities (a project, an interaction, an equipment…). Pinned chips are
 * removable with an undo; structural chips (anchor/related) are read-only.
 */
export default function ContextPanel({ conversation, queryKey }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const [expanded, setExpanded] = useSessionState('agent.context.expanded', true);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const pin = usePinContext(queryKey);
  const unpin = useUnpinContext(queryKey);

  const items = React.useMemo(
    () => conversation.injected_context ?? [],
    [conversation.injected_context],
  );
  const presentKeys = React.useMemo(() => new Set(items.map(itemKey)), [items]);

  const handleSelect = (result: AgentSearchResult) => {
    setPickerOpen(false);
    pin.mutate(
      {
        conversationId: conversation.id,
        entityType: result.entity_type,
        objectId: result.object_id,
      },
      {
        onSuccess: () =>
          toast({ description: t('agent.context.added', { label: result.label }), variant: 'success' }),
      },
    );
  };

  const handleRemove = (item: AgentContextItem) => {
    unpin.mutate(
      {
        conversationId: conversation.id,
        entityType: item.entity_type,
        objectId: item.object_id,
      },
      {
        onSuccess: () =>
          toast({
            description: t('agent.context.removed', { label: item.label }),
            duration: 8000,
            action: {
              label: t('common.undo'),
              onClick: () =>
                pin.mutate({
                  conversationId: conversation.id,
                  entityType: item.entity_type,
                  objectId: item.object_id,
                }),
            },
          }),
      },
    );
  };

  return (
    <Card className="p-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left"
        data-testid="agent-context-toggle"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium text-foreground">
          {t('agent.context.title')}
          <span className="ml-1.5 text-muted-foreground">{items.length}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('agent.context.empty')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => {
                const Icon = ENTITY_ICONS[item.entity_type] ?? ENTITY_ICON_FALLBACK;
                const removable = item.origin === 'pinned';
                const chipInner = (
                  <>
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </>
                );
                return (
                  <span
                    key={itemKey(item)}
                    data-testid="agent-context-chip"
                    data-origin={item.origin}
                    className={cn(
                      'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                      removable
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground',
                    )}
                  >
                    {item.available && item.url ? (
                      <Link
                        to={item.url}
                        state={pushBack(location)}
                        className="inline-flex min-w-0 items-center gap-1 hover:underline"
                      >
                        {chipInner}
                      </Link>
                    ) : (
                      <span
                        className={cn('inline-flex min-w-0 items-center gap-1', !item.available && 'opacity-60')}
                        title={!item.available ? t('agent.context.unavailable') : undefined}
                      >
                        {chipInner}
                      </span>
                    )}
                    {removable ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        aria-label={t('agent.context.remove', { label: item.label })}
                        className="shrink-0 rounded-full p-0.5 hover:bg-primary/20"
                        data-testid="agent-context-remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            data-testid="agent-context-add"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('agent.context.add')}
          </Button>
        </div>
      ) : null}

      <AddContextDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        presentKeys={presentKeys}
        onSelect={handleSelect}
      />
    </Card>
  );
}
