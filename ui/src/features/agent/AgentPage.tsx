import * as React from 'react';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';
import ChatPanel from './ChatPanel';
import ConversationList from './ConversationList';
import { useConversation, useConversations, useCreateConversation } from './hooks';

export default function AgentPage() {
  const { t } = useTranslation();

  const conversationsQuery = useConversations();
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const conversationQuery = useConversation(currentId);
  const createConversation = useCreateConversation();

  // Auto-select the latest conversation only once, on first load — so clicking
  // "New conversation" (currentId → null) isn't immediately overridden.
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current && conversationsQuery.data) {
      initializedRef.current = true;
      if (conversationsQuery.data.length > 0) {
        setCurrentId(conversationsQuery.data[0].id);
      }
    }
  }, [conversationsQuery.data]);

  const handleSelect = React.useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const handleNew = React.useCallback(() => {
    setCurrentId(null);
  }, []);

  // Create-on-first-message: the panel calls this when submitting with no
  // active conversation, then keeps its optimistic turns.
  const ensureConversation = React.useCallback(async () => {
    const conversation = await createConversation.mutateAsync();
    setCurrentId(conversation.id);
    return conversation.id;
  }, [createConversation]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t('agent.title')} description={t('agent.description')}>
        <SheetDialog
          title={t('agent.conversations')}
          trigger={
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label={t('agent.conversations')}
              data-testid="agent-conversations-toggle"
            >
              <History className="h-4 w-4" />
            </Button>
          }
        >
          {({ close }) => (
            <ConversationList
              currentId={currentId}
              onSelect={(id) => {
                handleSelect(id);
                close();
              }}
              onNew={() => {
                handleNew();
                close();
              }}
              onCurrentDeleted={handleNew}
            />
          )}
        </SheetDialog>
      </PageHeader>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden w-64 shrink-0 border-r border-border pr-3 md:flex md:flex-col">
          <ConversationList
            currentId={currentId}
            onSelect={handleSelect}
            onNew={handleNew}
            onCurrentDeleted={handleNew}
          />
        </aside>

        <ChatPanel
          conversationId={currentId}
          conversation={conversationQuery.data}
          ensureConversation={ensureConversation}
          creating={createConversation.isPending}
          emptyTitle={t('agent.empty_title')}
          emptyHint={t('agent.empty_hint')}
          testIdPrefix="agent"
          className="flex-1"
        />
      </div>
    </div>
  );
}
