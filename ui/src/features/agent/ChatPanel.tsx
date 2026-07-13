import * as React from 'react';
import { Send, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import { Textarea } from '@/design-system/textarea';
import { cn } from '@/lib/utils';
import ChatBubble from './ChatBubble';
import PrivacyNotice from './PrivacyNotice';
import { hasAcceptedAgentPrivacy, acceptAgentPrivacy } from './privacyStorage';
import {
  useAgentCreatedUndo,
  useAgentMemoryEvents,
  useAgentUpdatedUndo,
  useStreamMessage,
} from './hooks';
import type {
  AgentCitation,
  AgentConversationDetail,
  AgentMemoryEvent,
  AgentMessageRow,
  AgentWebSource,
} from './api';

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
  /** Memories the agent wrote this turn — rendered as a persistent 📌 line. */
  memoryEvents?: AgentMemoryEvent[];
  /** Public web sources the agent used this turn (web_search tool). */
  webSources?: AgentWebSource[];
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
    memoryEvents: row.metadata?.memory_events,
    webSources: row.metadata?.web_sources,
  };
}

// Backend tool names with a dedicated i18n status label (agent.tools.*).
const KNOWN_TOOLS = new Set([
  'search_household',
  'list_entities',
  'get_entity',
  'get_related',
  'create_entity',
  'update_entity',
  'manage_memory',
]);

interface ChatPanelProps {
  /** The active conversation, or null when none is selected/created yet. */
  conversationId: string | null;
  /** The loaded conversation detail — its messages seed the transcript once per id. */
  conversation?: AgentConversationDetail;
  /**
   * Create-on-first-message: called when the user submits with no active
   * conversation; must return the new conversation id. When absent, the panel
   * stays disabled until `conversationId` is set (entity-anchored mode).
   */
  ensureConversation?: () => Promise<string>;
  /** True while `ensureConversation` (or any external setup) is pending. */
  creating?: boolean;
  emptyTitle: string;
  emptyHint: string;
  /** Prefix for data-testid attributes ('agent' or 'agent-entity'). */
  testIdPrefix: string;
  className?: string;
}

/**
 * The agent chat transcript + composer, shared by AgentPage (with sidebar and
 * create-on-first-message) and EntityAssistant (one persistent anchored
 * conversation). Owns the optimistic transcript, retry-on-error, the privacy
 * gate and the created/updated undo toasts.
 */
export default function ChatPanel({
  conversationId,
  conversation,
  ensureConversation,
  creating = false,
  emptyTitle,
  emptyHint,
  testIdPrefix,
  className,
}: ChatPanelProps) {
  const { t } = useTranslation();

  const streamMessage = useStreamMessage();
  const notifyCreated = useAgentCreatedUndo();
  const notifyUpdated = useAgentUpdatedUndo();
  const notifyMemory = useAgentMemoryEvents();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState('');
  const [needsPrivacy, setNeedsPrivacy] = React.useState(false);
  // Live progress of the in-flight turn: partial text + the tool currently
  // running. Text received before a tool call is preamble ("je cherche…") and
  // is discarded when the tool event arrives.
  const [live, setLive] = React.useState<{ text: string; tool: string | null } | null>(null);

  // Guards against re-seeding local messages from a background refetch: we only
  // load a conversation's persisted turns the first time we see it.
  const loadedRef = React.useRef<string | null>(null);
  // Tracks the conversationId prop so switching conversations clears the
  // transcript — except when the id change comes from our own ensureConversation
  // (the optimistic turns must survive).
  const lastPropIdRef = React.useRef<string | null>(conversationId);

  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const isBusy = streamMessage.isPending || creating;

  React.useEffect(() => {
    setNeedsPrivacy(!hasAcceptedAgentPrivacy());
  }, []);

  // Parent switched conversation (select / new): reset the transcript.
  React.useEffect(() => {
    if (conversationId === lastPropIdRef.current) return;
    lastPropIdRef.current = conversationId;
    if (loadedRef.current === conversationId) return; // we created it mid-submit
    loadedRef.current = null;
    setMessages([]);
  }, [conversationId]);

  // Seed local messages from the loaded conversation, once per conversation.
  React.useEffect(() => {
    if (conversation && loadedRef.current !== conversation.id) {
      loadedRef.current = conversation.id;
      setMessages(conversation.messages.map(toMessage));
    }
  }, [conversation]);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isBusy, live]);

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
      if (!trimmed || isBusy) return;
      if (!conversationId && !ensureConversation) return;
      if (retryQuestion) {
        setMessages((prev) => prev.filter((m) => m.variant !== 'error'));
      } else {
        setDraft('');
        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, variant: 'user', text: trimmed },
        ]);
      }

      setLive({ text: '', tool: null });
      try {
        let id = conversationId;
        if (!id) {
          id = await ensureConversation!();
          // Mark as loaded so the detail fetch doesn't clobber optimistic turns.
          loadedRef.current = id;
          lastPropIdRef.current = id;
        }
        const agentMsg = await streamMessage.mutateAsync({
          conversationId: id,
          question: trimmed,
          handlers: {
            onDelta: (text) =>
              // A delta after a tool event starts the next turn's text fresh.
              setLive((prev) => ({
                text: (prev && !prev.tool ? prev.text : '') + text,
                tool: null,
              })),
            onTool: (name) => setLive({ text: '', tool: name }),
          },
        });
        setMessages((prev) => [
          ...prev,
          {
            id: agentMsg.id,
            variant: 'agent',
            text: agentMsg.content,
            citations: agentMsg.citations,
            truncated: Boolean(agentMsg.metadata?.truncated),
            memoryEvents: agentMsg.metadata?.memory_events,
            webSources: agentMsg.metadata?.web_sources,
          },
        ]);
        notifyCreated(agentMsg.metadata?.created_entities);
        notifyUpdated(agentMsg.metadata?.updated_entities);
        notifyMemory(agentMsg.metadata?.memory_events);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, variant: 'error', text: t('agent.error'), question: trimmed },
        ]);
      } finally {
        setLive(null);
      }
    },
    [draft, isBusy, conversationId, ensureConversation, streamMessage, notifyCreated, notifyUpdated, notifyMemory, t],
  );

  const toolLabel = live?.tool
    ? t(KNOWN_TOOLS.has(live.tool) ? `agent.tools.${live.tool}` : 'agent.tools.default')
    : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const isEmpty = messages.length === 0 && !isBusy;
  const disabled = needsPrivacy || isBusy || (!conversationId && !ensureConversation);

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', className)}>
      <PrivacyNotice open={needsPrivacy} onAccept={handleAcceptPrivacy} />

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
        data-testid={`${testIdPrefix}-messages`}
      >
        {isEmpty ? (
          <EmptyHint title={emptyTitle} hint={emptyHint} />
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
                  memoryEvents={msg.memoryEvents}
                  webSources={msg.webSources}
                />
              );
            }
            return (
              <ErrorBubble
                key={msg.id}
                text={msg.text}
                testIdPrefix={testIdPrefix}
                onRetry={() => void submit(msg.question)}
              />
            );
          })
        )}
        {isBusy ? (
          <ChatBubble variant="streaming" text={live?.text ?? ''} toolLabel={toolLabel} />
        ) : null}
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
          data-testid={`${testIdPrefix}-input`}
        />
        <Button
          type="submit"
          disabled={disabled || draft.trim().length === 0}
          data-testid={`${testIdPrefix}-send`}
          aria-label={t('agent.send')}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function EmptyHint({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm">{hint}</p>
    </div>
  );
}

function ErrorBubble({
  text,
  onRetry,
  testIdPrefix,
}: {
  text: string;
  onRetry: () => void;
  testIdPrefix: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-start" data-testid={`${testIdPrefix}-bubble-error`}>
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
            data-testid={`${testIdPrefix}-retry`}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t('agent.retry')}
          </Button>
        </div>
      </div>
    </div>
  );
}
