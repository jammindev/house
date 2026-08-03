import { Check, ExternalLink, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCapabilities } from '@/lib/capabilities';
import { SettingsSection } from './SettingsSection';

/**
 * Ce que cette instance sait faire — et ce qui lui manque pour le reste.
 *
 * Les six capacités optionnelles au même endroit, avec pour chacune ce qu'on
 * perd sans elle et le lien qui explique comment la poser. Les écrans concernés
 * le disent déjà là où l'utilisateur bute (`CapabilityNotice`) ; cette section
 * répond à l'autre question, celle de celui qui installe : **qu'est-ce qui
 * dort ici ?**
 *
 * Une capacité absente n'est pas une erreur et ne se peint pas en rouge : un
 * foyer qui n'a pas de bot Telegram n'a rien de cassé. D'où le gris.
 */
export function CapabilitiesSection() {
  const { t } = useTranslation();
  const { data, isLoading } = useCapabilities();

  if (isLoading) {
    return (
      <SettingsSection
        title={t('capabilities.title')}
        description={t('capabilities.description')}
      >
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </SettingsSection>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <SettingsSection
      title={t('capabilities.title')}
      description={t('capabilities.description')}
    >
      <ul className="divide-y divide-border">
        {data.map((capability) => (
          <li key={capability.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className={
                capability.available
                  ? 'mt-0.5 text-primary'
                  : 'mt-0.5 text-muted-foreground'
              }
              aria-hidden="true"
            >
              {capability.available ? (
                <Check className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {t(`capabilities.${capability.key}.name`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {capability.available
                  ? t(`capabilities.${capability.key}.enabled`)
                  : t(`capabilities.${capability.key}.without`)}
              </p>

              {!capability.available && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {capability.env_vars.map((name, index) => (
                    <span key={name}>
                      {index > 0 && ', '}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">{name}</code>
                    </span>
                  ))}
                  {capability.env_vars.length > 0 && ' — '}
                  <a
                    href={capability.docs_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {t('capabilities.howToEnable')}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
