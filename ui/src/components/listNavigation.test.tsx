import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadMore from './LoadMore';
import Pager from './Pager';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

describe('LoadMore', () => {
  it('propose la suite tant qu’il en reste', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    render(<LoadMore shown={50} total={116} onLoadMore={onLoadMore} />);

    expect(screen.getByText(/50.*116/)).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('disparaît quand tout est affiché', () => {
    const { container } = render(<LoadMore shown={12} total={12} onLoadMore={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dit pourquoi il s’arrête au plafond du serveur', () => {
    // ⚠️ Le cœur du correctif. Un bouton qui n'avance plus est le mur d'origine
    // déplacé de cinquante lignes : au plafond, la phrase remplace le bouton.
    render(<LoadMore shown={200} total={1043} max={200} onLoadMore={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/cappedAtMax/)).toBeInTheDocument();
  });
});

describe('Pager', () => {
  const base = { shown: 50, total: 260, onPrevious: vi.fn(), onNext: vi.fn() };

  it('ne s’affiche pas quand tout tient sur une page', () => {
    const { container } = render(<Pager {...base} offset={0} limit={50} shown={30} total={30} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('annonce les bornes, pas un numéro de page', () => {
    // « 51–100 sur 260 » permet de dire « j'ai traité jusqu'au centième » et de
    // reprendre là ; un numéro de page ne le permet pas.
    render(<Pager {...base} offset={50} limit={50} />);
    expect(screen.getByText(/"from":51.*"to":100.*"total":260/)).toBeInTheDocument();
  });

  it('bloque le retour sur la première page et la suite sur la dernière', () => {
    const first = render(<Pager {...base} offset={0} limit={50} />);
    const [previous, next] = screen.getAllByRole('button');
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    first.unmount();

    render(<Pager {...base} offset={250} limit={50} shown={10} />);
    const [prev2, next2] = screen.getAllByRole('button');
    expect(prev2).toBeEnabled();
    expect(next2).toBeDisabled();
  });
});
