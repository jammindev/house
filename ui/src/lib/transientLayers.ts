import * as React from 'react';

/**
 * Registre des « couches transitoires » ouvertes — panneaux flottants (picker,
 * menu, popover maison) rendus **à l'intérieur** d'un dialog.
 *
 * Pourquoi ça existe : Radix attache son écouteur d'Échap en **capture sur
 * `document`**, et le dialog est monté avant le panneau qu'il contient. Deux
 * écouteurs de capture sur le même nœud se déclenchent dans leur ordre
 * d'enregistrement : le dialog gagne toujours, donc un `stopImmediatePropagation`
 * posé par le panneau arrive trop tard. Résultat sans ce registre : Échap
 * fermait le formulaire entier et faisait perdre la saisie, au lieu de refermer
 * seulement le panneau.
 *
 * Le contrat est donc inversé — c'est le dialog qui demande « quelqu'un a-t-il
 * besoin de cet Échap ? » via `hasOpenTransientLayer()` dans son
 * `onEscapeKeyDown`, et s'abstient de se fermer le cas échéant. Le panneau, lui,
 * se contente de se déclarer pendant qu'il est ouvert.
 */
let openCount = 0;

/** Vrai si au moins une couche transitoire est ouverte. */
export function hasOpenTransientLayer(): boolean {
  return openCount > 0;
}

/**
 * Déclare une couche transitoire ouverte le temps que `open` est vrai.
 *
 * Un compteur, pas un booléen : deux panneaux peuvent se chevaucher (un picker
 * dans un dialog qui en contient un autre), et le premier à se fermer ne doit
 * pas rendre l'Échap au dialog alors que le second est encore ouvert.
 */
export function useTransientLayer(open: boolean): void {
  React.useEffect(() => {
    if (!open) return;
    openCount += 1;
    return () => {
      openCount = Math.max(0, openCount - 1);
    };
  }, [open]);
}
