import * as React from 'react';
import { Send, Sparkles, AlertTriangle, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { Textarea } from '@/design-system/textarea';
import { SheetDialog } from '@/design-system/sheet-dialog';
import ChatBubble from './ChatBubble';
import ConversationList from './ConversationList';
import PrivacyNotice from './PrivacyNotice';
import { hasAcceptedAgentPrivacy, acceptAgentPrivacy } from './privacyStorage';
import {
  useAgentCreatedUndo,
  useConversation,
  useConversations,
  useCreateConversation,
  usePostMessage,
} from './hooks';
import type { AgentCitation, AgentMessageRow } from './api';

interface UserMessage {
  id: string;
  variant: 'user';
  text: string;
}

interface AgentMessage {
  id: string;
  variant: 'agent';
  text: string;
  citations: AgentCitation[];
}

interface ErrorMessage {
  id: string;
  variant: 'error';
  text: string;
}

type Message = UserMessage | AgentMessage | ErrorMessage;

function toMessage(row: AgentMessageRow): Message {
  if (row.role === 'user') {
    return { id: row.id, variant: 'user', text: row.content };
  }
  return { id: row.id, variant: 'agent', text: row.content, citations: row.citations };
}

export default function AgentPage() {
  const { t } = useTranslation();

  const conversationsQuery = useConversations();
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const conversationQuery = useConversation(currentId);
  const createConversation = useCreateConversation();
  const postMessage = usePostMessage();
  const notifyCreated = useAgentCreatedUndo();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState('');
  const [needsPrivacy, setNeedsPrivacy] = React.useState(false);

  // Guards against re-seeding local messages from a background refetch: we only
  // load a conversation's persisted turns the first time we see it.
  const loadedRef = React.useRef<string | null>(null);
  // Auto-select the latest conversation only once, on first load — so clicking
  // "New conversation" (currentId → null) isn't immediately overridden.
  const initializedRef = React.useRef(false);

  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const isBusy = postMessage.isPending || createConversation.isPending;

  React.useEffect(() => {
    setNeedsPrivacy(!hasAcceptedAgentPrivacy());
  }, []);

  // On first load, continue the most recent conversation (survives reload).
  React.useEffect(() => {
    if (!initializedRef.current && conversationsQuery.data) {
      initializedRef.current = true;
      if (conversationsQuery.data.length > 0) {
        setCurrentId(conversationsQuery.data[0].id);
      }
    }
  }, [conversationsQuery.data]);

  const handleSelect = React.useCallback(
    (id: string) => {
      if (id === currentId) return;
      loadedRef.current = null;
      setMessages([]);
      setCurrentId(id);
    },
    [currentId],
  );

  const handleNew = React.useCallback(() => {
    loadedRef.current = null;
    setMessages([]);
    setCurrentId(null);
  }, []);

  // Seed local messages from the loaded conversation, once per conversation.
  React.useEffect(() => {
    const detail = conversationQuery.data;
    if (detail && loadedRef.current !== detail.id) {
      loadedRef.current = detail.id;
      setMessages(detail.messages.map(toMessage));
    }
  }, [conversationQuery.data]);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isBusy]);

  const handleAcceptPrivacy = React.useCallback(() => {
    acceptAgentPrivacy();
    setNeedsPrivacy(false);
    textareaRef.current?.focus();
  }, []);

  const submit = React.useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || isBusy) return;
    setDraft('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, variant: 'user', text: trimmed },
    ]);

    try {
      let conversationId = currentId;
      if (!conversationId) {
        const conversation = await createConversation.mutateAsync();
        conversationId = conversation.id;
        // Mark as loaded so the detail fetch doesn't clobber optimistic turns.
        loadedRef.current = conversation.id;
        setCurrentId(conversation.id);
      }
      const agentMsg = await postMessage.mutateAsync({ conversationId, question: trimmed });
      setMessages((prev) => [
        ...prev,
        {
          id: agentMsg.id,
          variant: 'agent',
          text: agentMsg.content,
          citations: agentMsg.citations,
        },
      ]);
      notifyCreated(agentMsg.metadata?.created_entities);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, variant: 'error', text: t('agent.error') },
      ]);
    }
  }, [draft, isBusy, currentId, createConversation, postMessage, notifyCreated, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const isEmpty = messages.length === 0 && !isBusy;

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

      <PrivacyNotice open={needsPrivacy} onAccept={handleAcceptPrivacy} />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden w-64 shrink-0 border-r border-border pr-3 md:flex md:flex-col">
          <ConversationList
            currentId={currentId}
            onSelect={handleSelect}
            onNew={handleNew}
            onCurrentDeleted={handleNew}
          />
        </aside>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
          data-testid="agent-messages"
        >
          {isEmpty ? (
            <EmptyHint />
          ) : (
            messages.map((msg) => {
              if (msg.variant === 'user') {
                return <ChatBubble key={msg.id} variant="user" text={msg.text} />;
              }
              if (msg.variant === 'agent') {
                return (
                  <ChatBubble
                    key={msg.id}
                    variant="agent"
                    text={msg.text}
                    citations={msg.citations}
                  />
                );
              }
              return <ErrorBubble key={msg.id} text={msg.text} />;
            })
          )}
          {isBusy ? <ChatBubble variant="loading" /> : null}
          <div ref={scrollAnchorRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2 rounded-xl border border-border bg-card p-2"
        >
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('agent.input_placeholder')}
            rows={2}
            disabled={needsPrivacy || isBusy}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            data-testid="agent-input"
          />
          <Button
            type="submit"
            disabled={needsPrivacy || isBusy || draft.trim().length === 0}
            data-testid="agent-send"
            aria-label={t('agent.send')}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        </div>
      </div>
    </div>
  );
}

function EmptyHint() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{t('agent.empty_title')}</p>
      <p className="max-w-md text-sm">{t('agent.empty_hint')}</p>
    </div>
  );
}

function ErrorBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start" data-testid="agent-bubble-error">
      <div className="flex max-w-[85%] gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {text}
        </div>
      </div>
    </div>
  );
}
