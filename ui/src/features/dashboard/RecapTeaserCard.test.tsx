import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RecapTeaserCard from './RecapTeaserCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const recap = { id: 'r1', month: '2026-06', card_count: 3, chapters: [], created_at: '' };

let user: { recap_dismissed_month: string };
const mutate = vi.fn();
let mutationState: { isError: boolean; variables?: { recap_dismissed_month?: string } };

vi.mock('@/features/recap/hooks', () => ({
  useLatestRecap: () => ({ data: recap }),
}));

vi.mock('@/features/settings/hooks', () => ({
  useCurrentUser: () => ({ data: user }),
  useUpdateProfile: () => ({ mutate, ...mutationState }),
}));

function renderTeaser() {
  return render(
    <MemoryRouter>
      <RecapTeaserCard />
    </MemoryRouter>,
  );
}

/**
 * Régression #626 — le maillon front du masquage du teaser.
 *
 * Le drapeau « vu » vivait en `sessionStorage`, et le commentaire du composant
 * assumait le coût : « the card reappears in another browser ». Il réapparaissait
 * bien plus souvent que ça — le stockage mourant avec l'onglet, un onglet neuf
 * suffisait à ramener la carte sur la même machine.
 *
 * Ce que ces tests tiennent, et que le serveur seul ne prouve pas :
 *
 * 1. **Le composant lit la préférence du compte.** C'est ce qu'un autre appareil
 *    reçoit ; le lire ailleurs, c'est le bug d'origine.
 * 2. **Fermer écrit sur le compte**, avec le mois affiché — pas un booléen, sinon
 *    le récap suivant resterait muet lui aussi.
 * 3. **Un autre mois masqué ne masque pas celui-ci** : la carte doit reprendre la
 *    parole toute seule au mois suivant.
 * 4. **Une écriture qui échoue ne laisse pas la carte cachée.** Masquer sur la foi
 *    d'une préférence que personne n'a réussi à enregistrer, c'est reproduire le
 *    silence qu'on corrige, à l'envers.
 */
describe('le teaser du récap', () => {
  beforeEach(() => {
    mutate.mockClear();
    user = { recap_dismissed_month: '' };
    mutationState = { isError: false, variables: undefined };
  });

  it("s'affiche tant que rien n'a été masqué", () => {
    renderTeaser();

    expect(screen.getByText(/recap\.teaser\.ready/)).toBeTruthy();
  });

  it('reste masqué pour un mois fermé depuis un autre appareil', () => {
    // Ce navigateur-ci n'a jamais rien fermé : la préférence vient du compte.
    user = { recap_dismissed_month: '2026-06' };

    renderTeaser();

    expect(screen.queryByText(/recap\.teaser\.ready/)).toBeNull();
  });

  it('écrit le mois fermé sur le compte, jamais dans le navigateur', async () => {
    renderTeaser();

    await userEvent.click(screen.getByRole('button', { name: 'common.close' }));

    expect(mutate).toHaveBeenCalledWith({ recap_dismissed_month: '2026-06' });
  });

  it('laisse le mois suivant reprendre la parole', () => {
    user = { recap_dismissed_month: '2026-05' };

    renderTeaser();

    expect(screen.getByText(/recap\.teaser\.ready/)).toBeTruthy();
  });

  it('disparaît sans attendre le serveur', () => {
    mutationState = { isError: false, variables: { recap_dismissed_month: '2026-06' } };

    renderTeaser();

    expect(screen.queryByText(/recap\.teaser\.ready/)).toBeNull();
  });

  it("revient si l'enregistrement a échoué", () => {
    mutationState = { isError: true, variables: { recap_dismissed_month: '2026-06' } };

    renderTeaser();

    expect(screen.getByText(/recap\.teaser\.ready/)).toBeTruthy();
  });
});
