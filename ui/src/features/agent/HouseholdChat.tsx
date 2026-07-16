import * as React from 'react';
import { History, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';
import ChatPanel from './ChatPanel';
import ContextPanel from './ContextPanel';
import ConversationList from './ConversationList';
import { agentKeys, useConversation, useCreateConversation } from './hooks';
import { useAgentSuggestions } from './suggestions';

interface Props {
  /**
   * Compact chrome for the floating launcher: a single top bar (history · title
   * · new) and no persistent desktop sidebar. Default (false) is the full
   * `/app/agent` page — desktop header + persistent conversation sidebar.
   */
  compact?: boolean;
}

/**
 * The household-wide (non-anchored) assistant: create-on-first-message,
 * suggestions, conversation history and — once a conversation exists — the
 * "what I know" context panel so extra entities can be pinned. Shared by
 * `AgentPage` (full page) and `AgentLauncher` (compact slide-over).
 */
export default function HouseholdChat({ compact = false }: Props) {
  const { t } = useTranslation();

  // Always open on a fresh, empty conversation (à la ChatGPT/Claude): the past
  // threads stay one tap away in the list, but the landing screen is a blank
  // page — never an arbitrary old conversation auto-reopened.
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const conversationQuery = useConversation(currentId);
  const createConversation = useCreateConversation();
  const suggestions = useAgentSuggestions();
  const conversation = conversationQuery.data;

  const handleSelect = React.useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const handleNew = React.useCallback(() => {
    setCurrentId(null);
  }, []);

  // Create-on-first-message: the panel calls this when submitting with no
  // active conversation, then keeps its optimistic turns.
  const ensureConversation = React.useCallback(async () => {
    const created = await createConversation.mutateAsync();
    setCurrentId(created.id);
    return created.id;
  }, [createConversation]);

  // Title shown in the compact/mobile bar: the open conversation's, or a "new" label.
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

  const compactBar = (
    <div className="mb-2 flex items-center gap-2">
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
  );

  // Context panel (shown once a conversation exists) + the chat itself.
  const contextAndChat = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {conversation ? (
        <ContextPanel
          conversation={conversation}
          queryKey={agentKeys.conversation(conversation.id)}
        />
      ) : null}
      <ChatPanel
        conversationId={currentId}
        conversation={conversation}
        ensureConversation={ensureConversation}
        creating={createConversation.isPending}
        emptyTitle={t('agent.empty_title')}
        emptyHint={t('agent.empty_hint')}
        suggestions={suggestions}
        testIdPrefix="agent"
        className="flex-1"
      />
    </div>
  );

  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {compactBar}
        {contextAndChat}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Desktop: full page header + persistent sidebar. */}
      <div className="hidden md:block">
        <PageHeader title={t('agent.title')} description={t('agent.description')} />
      </div>

      {/* Mobile: a thin bar (history · title · new) so the chat gets the screen. */}
      <div className="md:hidden">{compactBar}</div>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden w-64 shrink-0 border-r border-border pr-3 md:flex md:flex-col">
          <ConversationList
            currentId={currentId}
            onSelect={handleSelect}
            onNew={handleNew}
            onCurrentDeleted={handleNew}
          />
        </aside>

        {contextAndChat}
      </div>
    </div>
  );
}
