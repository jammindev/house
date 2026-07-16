import HouseholdChat from './HouseholdChat';

/**
 * The dedicated `/app/agent` page — the household-wide assistant with its full
 * chrome (desktop header + persistent conversation sidebar). The chat itself
 * lives in `HouseholdChat`, shared with the global `AgentLauncher`.
 */
export default function AgentPage() {
  return <HouseholdChat />;
}
