import * as React from 'react';
import { Bot, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import AgentCitation from './AgentCitation';
import type { AgentCitation as Citation, AgentMemoryEvent } from './api';

const CITE_REGEX = /<cite\s+id="([^"]+)"\s*\/?>/gi;
const CITE_HREF_PREFIX = 'cite:';

interface UserBubbleProps {
  variant: 'user';
  text: string;
}

interface AgentBubbleProps {
  variant: 'agent';
  text: string;
  citations: Citation[];
  /** True when the answer was cut short by the model's token limit. */
  truncated?: boolean;
  /** Memories written this turn — rendered as a persistent 📌 line. */
  memoryEvents?: AgentMemoryEvent[];
}

interface LoadingBubbleProps {
  variant: 'loading';
}

interface StreamingBubbleProps {
  variant: 'streaming';
  /** The partial answer text received so far (may be empty). */
  text: string;
  /** Localized label of the tool currently executing, if any. */
  toolLabel?: string | null;
}

type Props = UserBubbleProps | AgentBubbleProps | LoadingBubbleProps | StreamingBubbleProps;

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

  if (props.variant === 'streaming') {
    return (
      <AgentBubbleShell>
        {props.text ? (
          <AnswerWithInlineCitations text={props.text} citations={[]} />
        ) : null}
        {props.toolLabel ? (
          <Loader label={props.toolLabel} />
        ) : props.text ? null : (
          <Loader />
        )}
      </AgentBubbleShell>
    );
  }

  return (
    <AgentBubbleShell>
      <AnswerWithInlineCitations text={props.text} citations={props.citations} />
      {props.truncated ? <TruncatedNotice /> : null}
      {props.memoryEvents && props.memoryEvents.length > 0 ? (
        <MemoryNotice events={props.memoryEvents} />
      ) : null}
      {props.citations.length > 0 ? (
        <CitationsPanel citations={props.citations} />
      ) : null}
    </AgentBubbleShell>
  );
}

// Persistent "📌 remembered / updated / forgotten" line under an agent answer.
// Survives reloads (driven by the message's stored metadata.memory_events),
// unlike the transient undo toast.
function MemoryNotice({ events }: { events: AgentMemoryEvent[] }) {
  const { t } = useTranslation();
  return (
    <div
      className="mt-1.5 space-y-0.5 text-xs text-muted-foreground"
      data-testid="agent-memory-notice"
    >
      {events.map((event) => (
        <p key={`${event.action}-${event.id}`}>
          📌 {t(`agent.memory.${event.action}.notice`)}
          {event.action === 'forgotten' ? null : (
            <span className="italic"> {event.content}</span>
          )}
        </p>
      ))}
    </div>
  );
}

function TruncatedNotice() {
  const { t } = useTranslation();
  return (
    <p
      className="mt-1.5 text-xs italic text-muted-foreground"
      data-testid="agent-truncated-notice"
    >
      {t('agent.truncated_notice')}
    </p>
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

function Loader({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-muted-foreground" data-testid="agent-loader">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
      <span>{label ?? t('agent.loading')}</span>
    </div>
  );
}

// Keep the default URL sanitization (blocks javascript:, etc.) but let our
// internal cite: scheme through so citation chips can be resolved.
function citeAwareUrlTransform(url: string): string {
  if (url.startsWith(CITE_HREF_PREFIX)) return url;
  return defaultUrlTransform(url);
}

/**
 * Render the agent's answer as markdown (bold, lists, headings, tables…) while
 * turning each <cite id="entity:id"/> marker into a numbered chip linking to the
 * cited entity. The marker is rewritten to an inline markdown link
 * `[](cite:entity:id)` so it survives markdown parsing without breaking the
 * surrounding paragraph flow; a custom `a` renderer swaps it for the chip.
 * Numbers follow the order of citations as returned by the API.
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

  const markdown = React.useMemo(
    () => text.replace(CITE_REGEX, (_match, tag: string) => `[cite](${CITE_HREF_PREFIX}${tag})`),
    [text],
  );

  const components = React.useMemo<Components>(
    () => ({
      a({ href, children, ...props }) {
        if (href?.startsWith(CITE_HREF_PREFIX)) {
          const tag = href.slice(CITE_HREF_PREFIX.length);
          const citation = citationByTag.get(tag);
          const index = indexByTag.get(tag);
          if (!citation || !index) return null;
          return (
            <span className="mx-0.5 align-baseline">
              <AgentCitation citation={citation} index={index} />
            </span>
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
            {...props}
          >
            {children}
          </a>
        );
      },
      p: ({ children }) => <p className="break-words [&:not(:last-child)]:mb-2">{children}</p>,
      ul: ({ children }) => (
        <ul className="list-disc space-y-0.5 pl-5 [&:not(:last-child)]:mb-2">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal space-y-0.5 pl-5 [&:not(:last-child)]:mb-2">{children}</ol>
      ),
      li: ({ children }) => <li className="break-words">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      h1: ({ children }) => <h1 className="text-base font-semibold [&:not(:last-child)]:mb-1.5">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-semibold [&:not(:last-child)]:mb-1.5">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-semibold [&:not(:last-child)]:mb-1.5">{children}</h3>,
      code: ({ children }) => (
        <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>
      ),
      pre: ({ children }) => (
        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs [&:not(:last-child)]:mb-2">
          {children}
        </pre>
      ),
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-border pl-2 text-muted-foreground [&:not(:last-child)]:mb-2">
          {children}
        </blockquote>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto [&:not(:last-child)]:mb-2">
          <table className="w-full border-collapse text-left">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="border border-border px-2 py-1 font-semibold">{children}</th>,
      td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
    }),
    [citationByTag, indexByTag],
  );

  return (
    <div className="break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={citeAwareUrlTransform}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
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
