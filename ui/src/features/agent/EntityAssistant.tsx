import { useTranslation } from 'react-i18next';
import ChatPanel from './ChatPanel';
import { useEntityConversation } from './hooks';

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

  return (
    <ChatPanel
      conversationId={conversationQuery.data?.id ?? null}
      conversation={conversationQuery.data}
      emptyTitle={t('agent.entity.empty_title')}
      emptyHint={t('agent.entity.empty_hint')}
      testIdPrefix="agent-entity"
      className="h-[60vh]"
    />
  );
}
