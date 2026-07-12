import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { CheckboxField } from '@/design-system/checkbox-field';
import { SettingsSection } from './SettingsSection';
import { useToast } from '@/lib/toast';
import { useUpdateHousehold } from '../hooks';
import { OPTIONAL_MODULES, useActiveHousehold } from '@/lib/modules';

/**
 * Modules actifs du foyer (parcours 15) : un toggle par module optionnel,
 * réservé à l'owner. Décocher masque le module pour tous les membres
 * (sidebar, dashboard, agent) sans toucher aux données.
 */
export function ModulesSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { household } = useActiveHousehold();
  const updateHousehold = useUpdateHousehold();

  if (!household || household.current_user_role !== 'owner') return null;

  const disabled = household.disabled_modules ?? [];

  async function handleToggle(key: string, enabled: boolean) {
    if (!household) return;
    const next = enabled ? disabled.filter((k) => k !== key) : [...disabled, key];
    try {
      await updateHousehold.mutateAsync({ id: household.id, payload: { disabled_modules: next } });
      // La sidebar et le switcher lisent d'autres caches households.
      void qc.invalidateQueries({ queryKey: ['households'] });
      toast({ description: t('settings.modules.saved'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    }
  }

  return (
    <SettingsSection
      title={t('settings.modules.title')}
      description={t('settings.modules.description')}
    >
      <div className="space-y-2">
        {OPTIONAL_MODULES.map((m) => (
          <CheckboxField
            key={m.key}
            id={`module-${m.key}`}
            label={t(m.labelKey)}
            checked={!disabled.includes(m.key)}
            onChange={(checked) => void handleToggle(m.key, checked)}
          />
        ))}
        <p className="text-xs text-muted-foreground">{t('settings.modules.hint')}</p>
      </div>
    </SettingsSection>
  );
}
