import * as React from 'react';

import { Card } from '@/design-system/card';
import { Logo } from '@/design-system/logo';

/**
 * La coquille des pages publiques — connexion, configuration initiale, mot de
 * passe oublié, réinitialisation, invitation.
 *
 * Elle existe parce que les cinq pages la réimplémentaient chacune, et qu'elles
 * avaient **déjà divergé** : deux portaient le bloc de marque (copié à
 * l'identique), trois n'en avaient aucun ; une seule avait un `px-4`, les quatre
 * autres collaient aux bords de l'écran sur mobile. C'est « un compteur ne peut
 * pas avoir deux définitions » appliqué à la première impression : ce sont les
 * seuls écrans qu'on voit sans compte, donc les seuls dont l'incohérence se lit
 * avant qu'on ait la moindre raison d'accorder du crédit au reste.
 */

/**
 * Le signe et le nom forment **un seul bloc**, côte à côte.
 *
 * L'empilement vertical d'avant laissait 24 px de blanc optique entre les deux :
 * `gap-3` plus le creux interne du tracé (le signe n'occupe que 18 des 24 unités
 * de son `viewBox`) plus l'interligne du mot. Deux éléments séparés par plus que
 * la hauteur de l'un d'eux ne se lisent plus comme une marque, mais comme un
 * dessin puis un titre.
 *
 * Le signe reste en `currentColor` : la couleur de marque ne vit que là où le
 * thème du foyer ne va pas (voir `design-system/logo.tsx`).
 */
export function AuthBrand() {
  return (
    <div className="flex items-center gap-2.5 text-foreground">
      <Logo size={30} />
      <span className="text-2xl font-semibold tracking-tight">Maisonnée</span>
    </div>
  );
}

interface AuthShellProps {
  /**
   * Le titre de la page — la tâche du moment, jamais la marque.
   *
   * Il est délibérément plus petit que le mot-signe : c'est la hiérarchie qui
   * était inversée sur `/login`, où « Connexion » (`text-2xl`) écrasait
   * « Maisonnée » (`text-xl`). Optionnel, parce qu'un état de chargement n'a pas
   * de titre à annoncer.
   */
  title?: string;
  subtitle?: React.ReactNode;
  /** Optionnel : un lien mort ou expiré n'a qu'un titre et une explication. */
  children?: React.ReactNode;
  /** Liens secondaires (mot de passe oublié, retour), sous la carte. */
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <AuthBrand />

      <div className="w-full max-w-sm space-y-4">
        <Card className="space-y-5 p-6">
          {title ? (
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </Card>

        {footer ? <div className="text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}

export default AuthShell;
