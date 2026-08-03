import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevicesSection } from './DevicesSection';

/**
 * Ce que ces tests tiennent :
 *
 * **Chacun lit les instructions de son propre téléphone, et seulement les siennes.**
 * L'écran livrait un jeton sans dire quoi en faire — or la réponse n'est pas la même
 * partout et l'utilisateur n'a aucun moyen de la deviner : sur Android le jeton ne
 * sert à rien, sur iOS il ne sert que dans un raccourci, sur un ordinateur la
 * question ne se pose pas. Afficher les trois revient à n'en afficher aucune.
 *
 * C'est la règle « ne jamais demander une information que House peut calculer »
 * appliquée à l'aide : la plateforme se lit, elle ne se demande pas.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks', () => ({
  useDeviceTokens: () => ({ data: [], isLoading: false }),
  useCreateDeviceToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeDeviceToken: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function pretendUserAgent(value: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value,
    configurable: true,
  });
}

const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

describe("l'écran Appareils parle à l'appareil qui le lit", () => {
  const original = window.navigator.userAgent;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    pretendUserAgent(original);
  });

  it('sur Android, dit qu’il n’y a rien à configurer', () => {
    pretendUserAgent(UA.android);
    render(<DevicesSection />);

    expect(screen.getByText('settings.devices.android.title')).toBeInTheDocument();
    expect(screen.queryByText('settings.devices.ios.title')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.devices.desktop.hint')).not.toBeInTheDocument();
  });

  it('sur iPhone, donne les trois étapes et les deux pièges', () => {
    pretendUserAgent(UA.ios);
    render(<DevicesSection />);

    expect(screen.getByText('settings.devices.ios.title')).toBeInTheDocument();
    expect(screen.getByText('settings.devices.ios.step1')).toBeInTheDocument();
    expect(screen.getByText('settings.devices.ios.warning')).toBeInTheDocument();
    expect(screen.queryByText('settings.devices.android.title')).not.toBeInTheDocument();
  });

  it('sur un ordinateur, renvoie vers le téléphone au lieu de faire semblant', () => {
    pretendUserAgent(UA.desktop);
    render(<DevicesSection />);

    expect(screen.getByText('settings.devices.desktop.hint')).toBeInTheDocument();
    expect(screen.queryByText('settings.devices.ios.title')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.devices.android.title')).not.toBeInTheDocument();
  });
});
