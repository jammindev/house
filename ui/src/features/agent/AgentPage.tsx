import * as React from 'react';
import { History, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';
import ChatPanel from './ChatPanel';
import ConversationList from './ConversationList';
import { useConversation, useCreateConversation } from './hooks';
import { useAgentSuggestions } from './suggestions';

export default function AgentPage() {
  const { t } = useTranslation();

  // Always open on a fresh, empty conversation (à la ChatGPT/Claude): the past
  // threads stay one tap away in the list, but the landing screen is a blank
  // page — never an arbitrary old conversation auto-reopened.
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const conversationQuery = useConversation(currentId);
  const createConversation = useCreateConversation();
  const suggestions = useAgentSuggestions();

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

  // Title shown in the mobile bar: the open conversation's, or a "new" label.
  const currentTitle = currentId
    ? conversationQuery.data?.title || t('agent.untitled')
    : t('agent.new_conversation');

  const historyButton = (extraClass: string) => (
    <SheetDialog
      title={t('agent.conversations')}
      trigger={
        <Button
          variant="outline"
          size="icon"
          className={extraClass}
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
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Desktop: full page header + persistent sidebar. */}
      <div className="hidden md:block">
        <PageHeader title={t('agent.title')} description={t('agent.description')} />
      </div>

      {/* Mobile: a thin bar (history · title · new) so the chat gets the screen. */}
      <div className="mb-2 flex items-center gap-2 md:hidden">
        {historyButton('')}
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-foreground">
          {currentTitle}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNew}
          aria-label={t('agent.new_conversation')}
          data-testid="agent-new-conversation-mobile"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

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
          suggestions={suggestions}
          testIdPrefix="agent"
          className="flex-1"
        />
      </div>
    </div>
  );
}
