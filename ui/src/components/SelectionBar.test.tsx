import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/design-system/button';
import SelectionBar from './SelectionBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/**
 * Le contrat de la barre de sélection — elle est **générique**, donc ce contrat est
 * ce sur quoi ses futurs appelants s'appuieront sans relire son code.
 *
 * 1. **Le compteur vient de l'appelant.** Une barre partagée n'impose pas le
 *    vocabulaire de ses hôtes : « 3 photos sélectionnées » se dit mieux que
 *    « 3 éléments ». Elle affiche donc la chaîne reçue, sans la recomposer.
 * 2. **Un seul bouton bascule, deux libellés.** Proposer « Tout sélectionner » quand
 *    tout est déjà coché est un clic pour rien ; proposer les deux côte à côte est un
 *    choix de plus à faire à chaque fois.
 * 3. **Quitter le mode et tout décocher sont deux gestes distincts.** Les confondre
 *    fait sortir du tri celui qui voulait juste repartir d'une sélection vide — et
 *    ces deux boutons se touchent.
 * 4. **La croix se nomme.** Sans texte, un bouton d'icône est muet pour un lecteur
 *    d'écran, et c'est celui qui fait sortir de l'écran.
 */
describe('SelectionBar', () => {
  let onToggleAll: Mock<() => void>;
  let onExit: Mock<() => void>;

  beforeEach(() => {
    onToggleAll = vi.fn<() => void>();
    onExit = vi.fn<() => void>();
  });

  function renderBar(
    props: Partial<React.ComponentProps<typeof SelectionBar>> = {},
  ) {
    return render(
      <SelectionBar
        label="3 photos sélectionnées"
        allSelected={false}
        onToggleAll={onToggleAll}
        onExit={onExit}
        {...props}
      />,
    );
  }

  it('affiche le compteur tel que l’appelant le formule', () => {
    renderBar();

    expect(screen.getByText('3 photos sélectionnées')).toBeInTheDocument();
  });

  it('propose de tout sélectionner tant que tout ne l’est pas', () => {
    renderBar({ allSelected: false });

    expect(screen.getByRole('button', { name: 'common.selectAll' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'common.clearSelection' }),
    ).not.toBeInTheDocument();
  });

  it('propose de tout décocher quand tout est sélectionné', () => {
    renderBar({ allSelected: true });

    expect(screen.getByRole('button', { name: 'common.clearSelection' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.selectAll' })).not.toBeInTheDocument();
  });

  it('n’offre qu’un seul bouton pour les deux libellés', () => {
    // Les deux côte à côte, c'est un choix de plus à faire à chaque lot.
    renderBar({ allSelected: true });

    const both = screen.queryAllByRole('button', {
      name: /common\.(selectAll|clearSelection)/,
    });
    expect(both).toHaveLength(1);
  });

  it('remonte la bascule, dans les deux sens', () => {
    const { rerender } = renderBar({ allSelected: false });
    fireEvent.click(screen.getByRole('button', { name: 'common.selectAll' }));

    rerender(
      <SelectionBar
        label="3 photos sélectionnées"
        allSelected
        onToggleAll={onToggleAll}
        onExit={onExit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.clearSelection' }));

    expect(onToggleAll).toHaveBeenCalledTimes(2);
  });

  it('quitte le mode par la croix, sans toucher à la sélection', () => {
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'common.exitSelection' }));

    expect(onExit).toHaveBeenCalledTimes(1);
    // Quitter n'est pas décocher : la barre ne doit pas déclencher les deux.
    expect(onToggleAll).not.toHaveBeenCalled();
  });

  it('ne quitte pas le mode quand on décoche tout', () => {
    renderBar({ allSelected: true });

    fireEvent.click(screen.getByRole('button', { name: 'common.clearSelection' }));

    expect(onExit).not.toHaveBeenCalled();
  });

  it('nomme sa croix pour un lecteur d’écran', () => {
    renderBar();

    // C'est le bouton qui fait sortir de l'écran : muet, il est un piège.
    expect(screen.getByLabelText('common.exitSelection')).toBeInTheDocument();
  });

  it('rend les actions de masse qu’on lui confie', () => {
    renderBar({ children: <Button type="button">Attribuer une zone</Button> });

    expect(screen.getByRole('button', { name: 'Attribuer une zone' })).toBeInTheDocument();
  });

  it('reste utilisable sans aucune action', () => {
    renderBar({ children: undefined });

    // Un appelant peut n'avoir que « tout sélectionner » à offrir.
    expect(screen.getByRole('button', { name: 'common.selectAll' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.exitSelection' })).toBeInTheDocument();
  });
});
