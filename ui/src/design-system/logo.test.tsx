import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './logo';

/**
 * La marque ne prend jamais la couleur du thème.
 *
 * `themes.css` porte 17 thèmes que l'utilisateur choisit. L'ancienne pastille de
 * la `TopBar` était en `bg-primary` : la marque changeait donc de couleur d'un
 * foyer à l'autre, ce qui n'est pas une marque. Le diff d'un `text-foreground`
 * et celui d'un `text-primary` se ressemblent, et le défaut ne se voit que sur
 * le thème de quelqu'un d'autre — d'où un test.
 *
 * Les contrôles qui traversent les fichiers (le tracé de `logo.tsx` contre celui
 * de `docs/assets/brand/logo-mark.svg`, la validité XML des SVG, l'existence des
 * icônes du manifeste) vivent dans `apps/core/tests/test_brand_assets.py` :
 * `docs/` est hors du root Vite, et Python est le seul côté qui voit tout le
 * dépôt.
 */
describe('la marque ne dépend pas du thème du foyer', () => {
  it('rend le signe en currentColor', () => {
    const { container } = render(<Logo />);
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('fill')).toBe('currentColor');
  });

  it('reste décoratif quand aucun titre n\'est donné', () => {
    // Le nom du produit est presque toujours écrit à côté : annoncer deux fois
    // « Maisonnée » à un lecteur d'écran est du bruit, pas de l'accessibilité.
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.getAttribute('role')).toBeNull();
  });

  it('devient une image nommée quand on lui donne un titre', () => {
    const { container } = render(<Logo title="Maisonnée" />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('role')).toBe('img');
    expect(svg!.getAttribute('aria-label')).toBe('Maisonnée');
  });
});
