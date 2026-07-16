import { useTranslation } from 'react-i18next';
import ChatPanel from './ChatPanel';
import ContextPanel from './ContextPanel';
import { agentKeys, useEntityConversation } from './hooks';

interface Props {
  /** A household entity type registered in the agent (e.g. 'project'). */
  entityType: string;
  /** The anchor entity's id. */
  objectId: string;
  /**
   * Height class for the inner chat. Defaults to a fixed `h-[60vh]` (embedded
   * in a detail page); the launcher passes `flex-1 min-h-0` to fill its sheet.
   */
  chatClassName?: string;
  /** Extra classes for the root wrapper (e.g. to make it fill a flex parent). */
  className?: string;
}

/**
 * Entity-anchored assistant: the same chat as AgentPage, minus the conversation
 * sidebar, bound to ONE persistent conversation whose context (the entity + its
 * linked items) is pre-injected server-side. Generic — drop it into any entity's
 * detail view (a project's tab, a zone's, an equipment's…) by passing its
 * `entityType` / `objectId`.
 */
export default function EntityAssistant({
  entityType,
  objectId,
  chatClassName = 'h-[60vh]',
  className = '',
}: Props) {
  const { t } = useTranslation();
  const conversationQuery = useEntityConversation(entityType, objectId);
  const conversation = conversationQuery.data;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {conversation ? (
        <ContextPanel
          conversation={conversation}
          queryKey={agentKeys.entityConversation(entityType, objectId)}
        />
      ) : null}
      <ChatPanel
        conversationId={conversation?.id ?? null}
        conversation={conversation}
        emptyTitle={t('agent.entity.empty_title')}
        emptyHint={t('agent.entity.empty_hint')}
        testIdPrefix="agent-entity"
        className={chatClassName}
      />
    </div>
  );
}
