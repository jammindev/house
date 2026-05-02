import * as React from 'react';
import { Bot, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AgentCitation from './AgentCitation';
import type { AgentCitation as Citation } from './api';

const CITE_REGEX = /<cite\s+id="([^"]+)"\s*\/?>/gi;

interface UserBubbleProps {
  variant: 'user';
  text: string;
}

interface AgentBubbleProps {
  variant: 'agent';
  text: string;
  citations: Citation[];
}

interface LoadingBubbleProps {
  variant: 'loading';
}

type Props = UserBubbleProps | AgentBubbleProps | LoadingBubbleProps;

export default function ChatBubble(props: Props) {
  if (props.variant === 'user') {
    return (
      <div className="flex justify-end" data-testid="agent-bubble-user">
        <div className="flex max-w-[85%] gap-2">
          <div className="rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
            {props.text}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    );
  }

  if (props.variant === 'loading') {
    return (
      <AgentBubbleShell>
        <Loader />
      </AgentBubbleShell>
    );
  }

  return (
    <AgentBubbleShell>
      <AnswerWithInlineCitations text={props.text} citations={props.citations} />
      {props.citations.length > 0 ? (
        <CitationsPanel citations={props.citations} />
      ) : null}
    </AgentBubbleShell>
  );
}

function AgentBubbleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start" data-testid="agent-bubble-agent">
      <div className="flex max-w-[85%] gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2 text-sm text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function Loader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-muted-foreground" data-testid="agent-loader">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
      <span>{t('agent.loading')}</span>
    </div>
  );
}

/**
 * Replace each <cite id="entity:id"/> marker inline with a numbered chip linking
 * to the cited entity. Numbers follow the order of citations as returned by the
 * API (first appearance in the answer).
 */
function AnswerWithInlineCitations({
  text,
  citations,
}: {
  text: string;
  citations: Citation[];
}) {
  const indexByTag = React.useMemo(() => {
    const map = new Map<string, number>();
    citations.forEach((c, i) => map.set(`${c.entity_type}:${c.id}`, i + 1));
    return map;
  }, [citations]);

  const citationByTag = React.useMemo(() => {
    const map = new Map<string, Citation>();
    citations.forEach((c) => map.set(`${c.entity_type}:${c.id}`, c));
    return map;
  }, [citations]);

  const parts = React.useMemo(() => {
    const result: React.ReactNode[] = [];
    const regex = new RegExp(CITE_REGEX.source, 'gi');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(
          <React.Fragment key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</React.Fragment>,
        );
      }
      const tag = match[1];
      const citation = citationByTag.get(tag);
      const index = indexByTag.get(tag);
      if (citation && index) {
        result.push(
          <span key={`c-${key++}`} className="mx-0.5 align-baseline">
            <AgentCitation citation={citation} index={index} />
          </span>,
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push(<React.Fragment key={`t-${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
    }
    return result;
  }, [text, citationByTag, indexByTag]);

  return <p className="whitespace-pre-wrap break-words">{parts}</p>;
}

function CitationsPanel({ citations }: { citations: Citation[] }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('agent.citations_label')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c, i) => (
          <AgentCitation key={`${c.entity_type}-${c.id}`} citation={c} index={i + 1} />
        ))}
      </div>
    </div>
  );
}
