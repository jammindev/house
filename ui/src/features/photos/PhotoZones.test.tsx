import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoThumb from './PhotoThumb';
import PhotoZonesEditor from './PhotoZonesEditor';
import type { DocumentItem } from '@/lib/api/documents';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

// Le vrai sélecteur charge l'arborescence du foyer ; ici seule compte la valeur
// qu'il rend et celle qu'il renvoie.
vi.mock('@/features/zones/ZonePicker', () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => (
    <div>
      <span data-testid="picked">{value.join(',')}</span>
      <button type="button" onClick={() => onChange([...value, 'z2'])}>
        pick-z2
      </button>
      <button type="button" onClick={() => onChange([])}>
        clear
      </button>
    </div>
  ),
}));

const mutate = vi.fn();

vi.mock('./hooks', async () => {
  const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
  return { ...actual, useSetPhotoZones: () => ({ mutate, isPending: false }) };
});

function photo(over: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'p1',
    name: 'photo p1',
    file_url: '/media/p1.jpg',
    thumbnail_url: '/media/thumb/p1.jpg',
    created_at: '2026-07-10T12:00:00Z',
    metadata: {},
    zone_links: [],
    ...over,
  } as DocumentItem;
}

/**
 * Ce que ces tests tiennent :
 *
 * 1. **La grille ne signale rien** — le manque de zone se dit dans la visionneuse,
 *    où le sélecteur qui le corrige est à un pli (voir `PhotoLightbox.test.tsx`).
 *    Peinte sur la vignette, la pastille surchargeait 100 % de la grille pour un
 *    geste qui n'y existait pas.
 * 2. **La pastille et le filtre lisent la même source.** « Sans zone » se déduit de
 *    `zone_links`, servi par la liste — jamais d'un état local. Deux définitions du
 *    même manque, et un écran finirait par contredire l'autre sur la même photo.
 * 3. **L'enregistrement est explicite et complet.** Un remplacement, pas un
 *    `attach` par clic ; et une sélection vidée s'enregistre comme telle — effacer
 *    les zones est un geste, pas un cas oublié.
 */
describe('la vignette ne signale plus le manque de zone', () => {
  it('ne peint aucune pastille, même sans zone', () => {
    render(<PhotoThumb photo={photo()} onOpen={vi.fn()} />);

    expect(screen.queryByText('photos.withoutZone')).not.toBeInTheDocument();
  });
});

describe('PhotoZonesEditor', () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  it('n’offre pas d’enregistrer tant que rien n’a changé', () => {
    render(<PhotoZonesEditor photo={photo({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] })} />);

    expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument();
  });

  it('part des zones déjà assignées', () => {
    render(<PhotoZonesEditor photo={photo({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] })} />);

    expect(screen.getByTestId('picked')).toHaveTextContent('z1');
  });

  it('enregistre le remplacement complet, pas le seul ajout', () => {
    render(<PhotoZonesEditor photo={photo({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick-z2' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ photoId: 'p1', zoneIds: ['z1', 'z2'] });
  });

  it('enregistre une sélection vidée — effacer les zones est un geste', () => {
    render(<PhotoZonesEditor photo={photo({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(mutate.mock.calls[0][0]).toEqual({ photoId: 'p1', zoneIds: [] });
  });

  it('n’écrit rien tant qu’on n’a pas enregistré', () => {
    render(<PhotoZonesEditor photo={photo()} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick-z2' }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('annuler ramène aux zones du serveur', () => {
    render(<PhotoZonesEditor photo={photo({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick-z2' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(screen.getByTestId('picked')).toHaveTextContent('z1');
    expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument();
  });

  it('suit la photo courante quand la visionneuse change d’image', () => {
    const { rerender } = render(
      <PhotoZonesEditor photo={photo({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] })} />,
    );

    rerender(
      <PhotoZonesEditor
        photo={photo({ id: 'p2', zone_links: [{ zone_id: 'z9', zone_name: 'Cave' }] })}
      />,
    );

    // Sans réalignement, la photo suivante s'ouvrirait sur les zones de la
    // précédente — et un enregistrement les lui aurait appliquées.
    expect(screen.getByTestId('picked')).toHaveTextContent('z9');
  });
});
