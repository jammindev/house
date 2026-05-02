import * as React from 'react';
import { Send, Sparkles, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { Textarea } from '@/design-system/textarea';
import ChatBubble from './ChatBubble';
import PrivacyNotice from './PrivacyNotice';
import { hasAcceptedAgentPrivacy, acceptAgentPrivacy } from './privacyStorage';
import { useAskAgent } from './hooks';
import type { AgentCitation } from './api';

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

export default function AgentPage() {
  const { t } = useTranslation();
  const askMutation = useAskAgent();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState('');
  const [needsPrivacy, setNeedsPrivacy] = React.useState(false);

  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    setNeedsPrivacy(!hasAcceptedAgentPrivacy());
  }, []);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, askMutation.isPending]);

  const handleAcceptPrivacy = React.useCallback(() => {
    acceptAgentPrivacy();
    setNeedsPrivacy(false);
    textareaRef.current?.focus();
  }, []);

  const submit = React.useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || askMutation.isPending) return;
    const userMsg: UserMessage = {
      id: `u-${Date.now()}`,
      variant: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    askMutation.mutate(trimmed, {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            variant: 'agent',
            text: data.answer,
            citations: data.citations,
          },
        ]);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            variant: 'error',
            text: t('agent.error'),
          },
        ]);
      },
    });
  }, [draft, askMutation, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const isEmpty = messages.length === 0 && !askMutation.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t('agent.title')} description={t('agent.description')} />

      <PrivacyNotice open={needsPrivacy} onAccept={handleAcceptPrivacy} />

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
          {askMutation.isPending ? <ChatBubble variant="loading" /> : null}
          <div ref={scrollAnchorRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
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
            disabled={needsPrivacy || askMutation.isPending}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            data-testid="agent-input"
          />
          <Button
            type="submit"
            disabled={needsPrivacy || askMutation.isPending || draft.trim().length === 0}
            data-testid="agent-send"
            aria-label={t('agent.send')}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
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
