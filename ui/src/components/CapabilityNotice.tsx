import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/design-system/card';
import { useCapability } from '@/lib/capabilities';
import { cn } from '@/lib/utils';

interface Props {
  /** Clé du registre (`assistant`, `semantic_search`, `email`, `push`, …). */
  capability: string;
  className?: string;
}

/**
 * « Cette instance ne peut pas encore faire ça — et voici comment l'activer. »
 *
 * Le seul texte autorisé à la place d'une capacité absente. Un écran vide, un
 * spinner sans fin ou une erreur technique disent tous la même chose à
 * l'utilisateur : le produit est cassé. Or il ne l'est pas — il lui manque une
 * clé, et **quelqu'un peut la poser**. C'est la différence entre un défaut et
 * une configuration, et elle ne se voit que si on l'écrit.
 *
 * Le composant ne connaît aucune capacité en particulier : le libellé vient du
 * catalogue i18n (`capabilities.<key>.*`), les variables et le lien viennent du
 * serveur. Ajouter une capacité n'y touche pas.
 */
export default function CapabilityNotice({ capability, className }: Props) {
  const { t } = useTranslation();
  const { capability: spec } = useCapability(capability);

  return (
    <Card className={cn('space-y-3 p-4', className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {t(`capabilities.${capability}.unavailable`)}
        </p>
        <p className="text-sm text-muted-foreground">
          {t(`capabilities.${capability}.without`)}
        </p>
      </div>

      {spec && spec.env_vars.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('capabilities.envVars')}{' '}
          {spec.env_vars.map((name, index) => (
            <span key={name}>
              {index > 0 && ', '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">{name}</code>
            </span>
          ))}
        </p>
      )}

      {spec && (
        <a
          href={spec.docs_url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          {t('capabilities.howToEnable')}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </Card>
  );
}
