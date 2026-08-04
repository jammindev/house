import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZonePicker from './ZonePicker';
import type { Zone } from '@/lib/api/zones';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const zones: Zone[] = [
  { id: 'z1', name: 'Maison', full_path: 'Maison', color: '#f00', parent: null } as Zone,
  { id: 'z2', name: 'Cuisine', full_path: 'Maison / Cuisine', color: '#0f0', parent: 'z1' } as Zone,
];

vi.mock('./hooks', async () => {
  const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
  return { ...actual, useZones: () => ({ data: zones, isLoading: false }) };
});

/**
 * Le placement du panneau, et pourquoi il est du métier.
 *
 * `ZonePicker` est le sélecteur de **24 écrans**. Son panneau était posé en
 * `absolute … mt-1`, donc déployé vers le bas quoi qu'il arrive : dans la card de
 * la visionneuse photo — collée au bas de la fenêtre — la recherche et la liste
 * tombaient hors de l'écran, et ranger une photo depuis la visionneuse devenait
 * impossible. Le même défaut guette tout champ bas dans une feuille mobile.
 *
 * Le test porte sur la **décision** (`data-placement`), pas sur les classes : c'est
 * elle qui est le comportement. Qu'elle tienne réellement dans l'écran se mesure
 * dans un vrai navigateur — `e2e/photos-lightbox.spec.ts`.
 */
describe('ZonePicker — placement du panneau', () => {
  let rect: Partial<DOMRect>;

  beforeEach(() => {
    // jsdom ne fait pas de layout : sans ce stub, tout élément est en 0×0 en haut
    // à gauche, et la bascule ne pourrait jamais être observée.
    rect = { top: 100, bottom: 140, left: 0, right: 200, width: 200, height: 40 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => rect as DOMRect,
    );
    window.innerHeight = 800;
  });

  afterEach(() => vi.restoreAllMocks());

  function openPanel() {
    render(<ZonePicker id="z" mode="multiple" value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /zones\.picker/i }));
    return screen.getByRole('dialog');
  }

  it('s’ouvre vers le bas quand la place ne manque pas', () => {
    expect(openPanel()).toHaveAttribute('data-placement', 'bottom');
  });

  it('bascule vers le haut quand le déclencheur est collé au bas de la fenêtre', () => {
    rect = { top: 700, bottom: 740, left: 0, right: 200, width: 200, height: 40 };

    expect(openPanel()).toHaveAttribute('data-placement', 'top');
  });

  it('reste vers le bas si le haut n’offre pas mieux — un panneau coupé en haut ne vaut pas mieux', () => {
    // Fenêtre courte : serré des deux côtés, mais un peu moins en dessous.
    window.innerHeight = 300;
    rect = { top: 120, bottom: 160, left: 0, right: 200, width: 200, height: 40 };

    expect(openPanel()).toHaveAttribute('data-placement', 'bottom');
  });
});
