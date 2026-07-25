import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AgentLauncher from './AgentLauncher';

// Le chat lui-même (requêtes API, i18n, react-query) n'est pas le sujet : on le
// remplace par un lien interne, équivalent d'une citation ou d'un chip contexte.
vi.mock('./HouseholdChat', () => ({
  default: () => <Link to="/app/documents/abc-123">Facture Engie</Link>,
}));
vi.mock('./EntityAssistant', () => ({ default: () => null }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function renderLauncher(initialPath = '/app/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CurrentPath />
      <Routes>
        <Route path="/app/*" element={<AgentLauncher />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgentLauncher', () => {
  beforeAll(() => {
    // jsdom n'implémente pas matchMedia, utilisé par useIsMobile (SheetDialog).
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('ferme le panneau quand on clique sur un lien du chat', async () => {
    const user = userEvent.setup();
    renderLauncher();

    await user.click(screen.getByTestId('agent-launcher-fab'));
    expect(await screen.findByTestId('agent-launcher-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Facture Engie' }));

    // La navigation a lieu ET le panneau se referme (sinon il masque la destination).
    expect(screen.getByTestId('path')).toHaveTextContent('/app/documents/abc-123');
    await waitFor(() =>
      expect(screen.queryByTestId('agent-launcher-panel')).not.toBeInTheDocument(),
    );
  });

  it('reste ouvert tant que rien ne navigue', async () => {
    const user = userEvent.setup();
    renderLauncher();

    await user.click(screen.getByTestId('agent-launcher-fab'));
    expect(await screen.findByTestId('agent-launcher-panel')).toBeInTheDocument();

    await user.click(screen.getByTestId('agent-launcher-panel'));
    expect(screen.getByTestId('agent-launcher-panel')).toBeInTheDocument();
  });
});
