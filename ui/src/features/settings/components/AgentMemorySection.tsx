import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { buttonVariants } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import { cn } from '@/lib/utils';
import { SettingsSection } from './SettingsSection';
import { useToast } from '@/lib/toast';
import { useCurrentUser, useUpdateProfile } from '../hooks';

/**
 * Settings card for the agent's user memory: a per-user toggle for automatic
 * capture + injection, and a link to the full management page ("what the agent
 * knows about me"). The toggle mirrors User.agent_memory_enabled.
 */
export function AgentMemorySection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const enabled = user?.agent_memory_enabled ?? true;

  async function handleToggle(next: boolean) {
    try {
      await updateProfile.mutateAsync({ agent_memory_enabled: next });
      toast({ description: t('agent.memory.settingsSaved'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    }
  }

  return (
    <SettingsSection
      title={t('agent.memory.settingsTitle')}
      description={t('agent.memory.settingsDescription')}
      actions={
        <Link
          to="/app/agent/memory"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {t('agent.memory.manage')}
        </Link>
      }
    >
      <div className="space-y-2">
        <CheckboxField
          id="agent-memory-enabled"
          label={t('agent.memory.toggleLabel')}
          checked={enabled}
          onChange={(checked) => void handleToggle(checked)}
        />
        <p className="text-xs text-muted-foreground">{t('agent.memory.toggleHint')}</p>
      </div>
    </SettingsSection>
  );
}
