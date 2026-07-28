import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoThumb from './PhotoThumb';
import PhotoZonesBulkDialog from './PhotoZonesBulkDialog';
import type { DocumentItem } from '@/lib/api/documents';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

vi.mock('@/features/zones/ZonePicker', () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => (
    <div>
      <span data-testid="picked">{value.join(',')}</span>
      <button type="button" onClick={() => onChange(['z1'])}>
        pick-z1
      </button>
    </div>
  ),
}));

const mutate = vi.fn();

vi.mock('./hooks', async () => {
  const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
  return { ...actual, useAddPhotosZones: () => ({ mutate, isPending: false }) };
});

function photo(id = 'p1'): DocumentItem {
  return {
    id,
    name: `photo ${id}`,
    file_url: `/media/${id}.jpg`,
    thumbnail_url: `/media/thumb/${id}.jpg`,
    created_at: '2026-07-10T12:00:00Z',
    metadata: {},
    zone_links: [],
  } as unknown as DocumentItem;
}

/**
 * Ce que ces tests tiennent :
 *
 * 1. **En mode sélection, la vignette coche — elle n'ouvre pas.** Ouvrir la
 *    visionneuse au milieu d'un tri de trente photos perd la sélection de vue et le
 *    fil de ce qu'on faisait.
 * 2. **C'est la présence du callback qui porte le mode**, pas un booléen de plus :
 *    deux sources pour le même état finissent par se contredire.
 * 3. **Le lot n'écrit rien sans zone choisie** — un « Enregistrer » actif qui
 *    n'ajoute rien ferait croire le rangement fait.
 */
describe('vignette en mode sélection', () => {
  it('coche au lieu d’ouvrir', () => {
    const onOpen = vi.fn();
    const onToggleSelected = vi.fn();
    render(<PhotoThumb photo={photo()} onOpen={onOpen} onToggleSelected={onToggleSelected} />);

    fireEvent.click(screen.getByRole('button', { name: 'photo p1' }));

    expect(onToggleSelected).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('ouvre normalement hors mode sélection', () => {
    const onOpen = vi.fn();
    render(<PhotoThumb photo={photo()} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'photo p1' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('dit son état de coche aux technologies d’assistance', () => {
    const { rerender } = render(
      <PhotoThumb photo={photo()} onOpen={vi.fn()} onToggleSelected={vi.fn()} selected={false} />,
    );
    expect(screen.getByRole('button', { name: 'photo p1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    rerender(
      <PhotoThumb photo={photo()} onOpen={vi.fn()} onToggleSelected={vi.fn()} selected />,
    );
    expect(screen.getByRole('button', { name: 'photo p1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('ne prétend pas être cochable hors mode sélection', () => {
    render(<PhotoThumb photo={photo()} onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'photo p1' })).not.toHaveAttribute('aria-pressed');
  });
});

describe('PhotoZonesBulkDialog', () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  function open(photoIds = ['p1', 'p2', 'p3'], onSaved = vi.fn()) {
    render(
      <PhotoZonesBulkDialog
        open
        onOpenChange={vi.fn()}
        photoIds={photoIds}
        onSaved={onSaved}
      />,
    );
    return onSaved;
  }

  it('refuse d’enregistrer tant qu’aucune zone n’est choisie', () => {
    open();

    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
  });

  it('envoie les photos cochées et les zones choisies en un appel', () => {
    open(['p1', 'p2']);

    fireEvent.click(screen.getByRole('button', { name: 'pick-z1' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ photoIds: ['p1', 'p2'], zoneIds: ['z1'] });
  });

  it('annonce que le lot ajoute, sans remplacer', () => {
    open();

    // Le texte est ce qui rend la sémantique vérifiable par l'utilisateur : sans
    // lui, « Enregistrer » pourrait aussi bien avoir écrasé ses zones.
    expect(screen.getByText('photos.zones.bulkHint')).toBeInTheDocument();
  });

  it('compte les photos dans son titre', () => {
    open(['p1', 'p2', 'p3']);

    expect(screen.getByText('photos.zones.bulkTitle:3')).toBeInTheDocument();
  });
});
