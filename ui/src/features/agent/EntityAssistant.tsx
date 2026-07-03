import * as React from 'react';
import { Send, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import { Textarea } from '@/design-system/textarea';
import ChatBubble from './ChatBubble';
import PrivacyNotice from './PrivacyNotice';
import { hasAcceptedAgentPrivacy, acceptAgentPrivacy } from './privacyStorage';
import { useAgentCreatedUndo, useEntityConversation, usePostMessage } from './hooks';
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
  truncated?: boolean;
}

interface ErrorMessage {
  id: string;
  variant: 'error';
  text: string;
  /** The question that failed, so the user can retry without retyping it. */
  question: string;
}

type Message = UserMessage | AgentMessage | ErrorMessage;

function toMessage(row: AgentMessageRow): Message {
  if (row.role === 'user') {
    return { id: row.id, variant: 'user', text: row.content };
  }
  return {
    id: row.id,
    variant: 'agent',
    text: row.content,
    citations: row.citations,
    truncated: Boolean(row.metadata?.truncated),
  };
}

interface Props {
  /** A household entity type registered in the agent (e.g. 'project'). */
  entityType: string;
  /** The anchor entity's id. */
  objectId: string;
}

/**
 * Entity-anchored assistant: the same chat as AgentPage, minus the conversation
 * sidebar, bound to ONE persistent conversation whose context (the entity + its
 * linked items) is pre-injected server-side. Generic — drop it into any entity's
 * detail view (a project's tab, a zone's, an equipment's…) by passing its
 * `entityType` / `objectId`.
 */
export default function EntityAssistant({ entityType, objectId }: Props) {
  const { t } = useTranslation();

  const conversationQuery = useEntityConversation(entityType, objectId);
  const conversationId = conversationQuery.data?.id ?? null;
  const postMessage = usePostMessage();
  const notifyCreated = useAgentCreatedUndo();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState('');
  const [needsPrivacy, setNeedsPrivacy] = React.useState(false);

  // Seed local messages from the loaded conversation once (guards against a
  // background refetch clobbering optimistic turns).
  const loadedRef = React.useRef<string | null>(null);
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const isBusy = postMessage.isPending;

  React.useEffect(() => {
    setNeedsPrivacy(!hasAcceptedAgentPrivacy());
  }, []);

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

  // `retryQuestion` re-submits a failed turn: the user bubble is already in the
  // transcript, so we only clear the stale error bubbles instead of re-adding it.
  const submit = React.useCallback(
    async (retryQuestion?: string) => {
      const trimmed = (retryQuestion ?? draft).trim();
      if (!trimmed || isBusy || !conversationId) return;
      if (retryQuestion) {
        setMessages((prev) => prev.filter((m) => m.variant !== 'error'));
      } else {
        setDraft('');
        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, variant: 'user', text: trimmed },
        ]);
      }

      try {
        const agentMsg = await postMessage.mutateAsync({ conversationId, question: trimmed });
        setMessages((prev) => [
          ...prev,
          {
            id: agentMsg.id,
            variant: 'agent',
            text: agentMsg.content,
            citations: agentMsg.citations,
            truncated: Boolean(agentMsg.metadata?.truncated),
          },
        ]);
        notifyCreated(agentMsg.metadata?.created_entities);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, variant: 'error', text: t('agent.error'), question: trimmed },
        ]);
      }
    },
    [draft, isBusy, conversationId, postMessage, notifyCreated, t],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const isEmpty = messages.length === 0 && !isBusy;
  const disabled = needsPrivacy || isBusy || !conversationId;

  return (
    <div className="flex h-[60vh] min-h-0 flex-col gap-4">
      <PrivacyNotice open={needsPrivacy} onAccept={handleAcceptPrivacy} />

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
        data-testid="agent-entity-messages"
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
                  truncated={msg.truncated}
                />
              );
            }
            return (
              <ErrorBubble
                key={msg.id}
                text={msg.text}
                onRetry={() => void submit(msg.question)}
              />
            );
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
          disabled={disabled}
          className="min-h-0 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          data-testid="agent-entity-input"
        />
        <Button
          type="submit"
          disabled={disabled || draft.trim().length === 0}
          data-testid="agent-entity-send"
          aria-label={t('agent.send')}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
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
      <p className="text-sm font-medium text-foreground">{t('agent.entity.empty_title')}</p>
      <p className="max-w-md text-sm">{t('agent.entity.empty_hint')}</p>
    </div>
  );
}

function ErrorBubble({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-start" data-testid="agent-entity-bubble-error">
      <div className="flex max-w-[85%] gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="space-y-1.5 rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{text}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            data-testid="agent-entity-retry"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t('agent.retry')}
          </Button>
        </div>
      </div>
    </div>
  );
}
