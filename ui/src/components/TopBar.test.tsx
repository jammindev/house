import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from './TopBar';
import type { AuthUser } from '@/lib/auth/authContext';

// Le header n'est pas le sujet de ses voisins : switcher, cloche et recherche
// tirent chacun sur react-query et l'API. On ne garde que la zone identité.
vi.mock('./HouseholdSwitcher', () => ({ default: () => null }));
vi.mock('@/features/notifications/NotificationsBell', () => ({ default: () => null }));
vi.mock('@/features/search/GlobalSearch', () => ({ default: () => null }));
vi.mock('@/features/weather/WeatherChip', () => ({ default: () => null }));
vi.mock('./SidebarToggleContext', () => ({ useSidebarToggle: () => ({ toggleSidebar: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const currentUser = vi.hoisted(() => ({ value: null as AuthUser | null }));
vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({ user: currentUser.value, logout: vi.fn() }),
}));

/** Un `/accounts/me/` tel que le sert l'endpoint — `full_name` compris.
 *
 * ⚠️ Cette fixture *suppose* le payload, elle ne le prouve pas : le premier
 * correctif de #546 est passé au vert ici alors que l'endpoint ne servait pas
 * `full_name`, et le header montrait toujours l'email en prod. Que la clé
 * existe pour de vrai est tenu côté serveur, par
 * `apps/accounts/tests/test_me_contract.py`.
 */
function renderTopBarFor(user: Partial<AuthUser>) {
  currentUser.value = {
    id: 'u1',
    email: 'foyer@example.com',
    first_name: '',
    last_name: '',
    display_name: '',
    full_name: 'foyer@example.com',
    active_household: 'h1',
    ...user,
  } as AuthUser;
  return render(<MemoryRouter><TopBar /></MemoryRouter>);
}

describe('TopBar — la zone identité', () => {
  // Régression #546. `first_name` / `last_name` ne sont pas éditables depuis
  // l'app (absents de `SELF_EDITABLE_FIELDS`) : un header qui ne lit qu'eux
  // retombe sur l'email pour tout le monde, tout le temps.
  it("affiche le nom d'affichage, pas l'email, quand le foyer en a un", () => {
    renderTopBarFor({ display_name: 'Benjamin', full_name: 'Benjamin' });

    expect(screen.getByTestId('topbar-display-name')).toHaveTextContent('Benjamin');
    expect(screen.getByTestId('topbar-display-name')).not.toHaveTextContent('foyer@example.com');
  });

  it("prend l'initiale sur le nom d'affichage, pas sur l'email", () => {
    renderTopBarFor({ display_name: 'Benjamin', full_name: 'Benjamin' });

    expect(screen.getByTestId('topbar-initial')).toHaveTextContent('B');
  });

  it("retombe sur l'email quand le compte n'a aucun nom", () => {
    renderTopBarFor({ display_name: '', full_name: 'foyer@example.com' });

    expect(screen.getByTestId('topbar-display-name')).toHaveTextContent('foyer@example.com');
  });

  // Le header nomme, il n'identifie pas : l'email vit dans les réglages. Il
  // n'apparaît ici que porté par `full_name`, faute de mieux (test ci-dessus).
  it("n'affiche pas l'email en seconde ligne", () => {
    const { container } = renderTopBarFor({ display_name: 'Benjamin', full_name: 'Benjamin' });

    expect(container).not.toHaveTextContent('foyer@example.com');
  });
});
