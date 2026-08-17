import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthShell } from './AuthShell';

/**
 * Deux garde-fous sur la seule chose qu'on voit de Maisonnée sans compte.
 *
 * Le défaut d'origine était visuel — « Connexion » en `text-2xl` écrasait
 * « Maisonnée » en `text-xl`, et le mot-signe flottait à 24 px du signe — mais
 * sa **cause** ne l'était pas : aucune des cinq pages publiques ne partageait sa
 * coquille, donc la hiérarchie n'était arbitrée nulle part. Deux d'entre elles
 * portaient le bloc de marque recopié, trois n'en avaient aucun, et une seule
 * avait un `px-4`.
 *
 * Ce qui se mesure est ici ; ce qui ne se mesure qu'à l'œil (l'espacement du
 * mot-signe, l'équilibre de la carte) est vérifié en capture d'écran, avant et
 * après. Un test qui prétendrait juger cela en jsdom, où aucune CSS n'est
 * appliquée, jugerait ses propres constantes.
 */

/** L'échelle typographique de Tailwind, en rem — un fait extérieur au composant. */
const TEXT_SCALE: Record<string, number> = {
  'text-xs': 0.75,
  'text-sm': 0.875,
  'text-base': 1,
  'text-lg': 1.125,
  'text-xl': 1.25,
  'text-2xl': 1.5,
  'text-3xl': 1.875,
  'text-4xl': 2.25,
};

function textSize(element: Element): number {
  const token = [...element.classList].find((cls) => cls in TEXT_SCALE);
  expect(token, `aucune taille de texte déclarée sur <${element.tagName.toLowerCase()}>`).toBeDefined();
  return TEXT_SCALE[token!];
}

describe('la coquille des pages publiques', () => {
  it('écrit la marque plus grand que le titre de la page', () => {
    const { getByRole, getByText } = render(
      <AuthShell title="Connexion">
        <form />
      </AuthShell>,
    );

    // La marque est ce qu'on reconnaît, le titre est la tâche du moment. Les
    // inverser, c'est présenter un formulaire avant de dire chez qui on est.
    expect(textSize(getByText('Maisonnée'))).toBeGreaterThan(
      textSize(getByRole('heading', { level: 1 })),
    );
  });

  it('garde le signe et le nom dans un seul bloc', () => {
    const { container, getByText } = render(<AuthShell title="Connexion" />);

    const mark = container.querySelector('svg');
    expect(mark).not.toBeNull();
    // Frères et sœurs dans le même conteneur : un mot-signe n'est pas un dessin
    // suivi d'un titre, c'est un seul objet.
    expect(getByText('Maisonnée').parentElement).toBe(mark!.parentElement);
  });

  it('n\'affiche pas de titre vide quand la page n\'en a pas à donner', () => {
    // L'invitation en cours de chargement n'a encore rien à annoncer : un `h1`
    // vide laisserait un blanc que le lecteur prendrait pour un défaut.
    const { queryByRole } = render(
      <AuthShell>
        <div />
      </AuthShell>,
    );
    expect(queryByRole('heading', { level: 1 })).toBeNull();
  });
});

/**
 * Le bloc de marque n'a qu'un seul domicile.
 *
 * C'est la moitié qui ne se voit pas en revue : le diff d'une page qui recopie
 * la marque ressemble exactement à celui d'une page qui la réutilise, et
 * l'écart ne se lit que sur l'écran d'à côté, celui qu'on n'a pas ouvert.
 */
const BRAND_HOME = './AuthShell.tsx';

const sources = import.meta.glob<string>('./*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('aucune page publique ne réimplémente la marque', () => {
  const pages = Object.entries(sources).filter(([path]) => path.endsWith('Page.tsx'));

  it('trouve bien les pages à vérifier', () => {
    // Sans quoi un glob devenu faux rendrait tout ce qui suit vert par vacuité.
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  it.each(pages)('%s passe par AuthShell', (_path, source) => {
    expect(source).toContain('<AuthShell');
  });

  it.each(pages)('%s ne réécrit ni le mot-signe ni le signe', (_path, source) => {
    expect(source).not.toContain('Maisonnée');
    expect(source).not.toMatch(/from ['"].*design-system\/logo['"]/);
  });

  it('garde le mot-signe dans AuthShell', () => {
    expect(sources[BRAND_HOME]).toContain('Maisonnée');
  });
});
