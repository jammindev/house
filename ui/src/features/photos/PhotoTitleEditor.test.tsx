import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoTitleEditor from './PhotoTitleEditor';
import type { DocumentItem } from '@/lib/api/documents';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const mutate = vi.fn();

vi.mock('./hooks', async () => {
  const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
  return { ...actual, useRenamePhoto: () => ({ mutate, isPending: false }) };
});

function photo(over: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'p1',
    name: 'IMG_4312.jpg',
    file_url: '/media/p1.jpg',
    created_at: '2026-07-10T12:00:00Z',
    metadata: {},
    ...over,
  } as DocumentItem;
}

/**
 * Renommer une photo depuis la photo.
 *
 * Le nom d'un fichier d'appareil ne dit rien, et le corriger demandait jusqu'ici de
 * quitter la galerie pour la fiche document — donc personne ne le corrigeait. Même
 * contrat que {@link PhotoZonesEditor} : brouillon local, enregistrement explicite,
 * et réalignement quand la visionneuse change d'image.
 */
describe('PhotoTitleEditor', () => {
  beforeEach(() => mutate.mockClear());

  it('part du nom servi par le serveur', () => {
    render(<PhotoTitleEditor photo={photo()} />);

    expect(screen.getByLabelText('photos.name.label')).toHaveValue('IMG_4312.jpg');
  });

  it('n’offre pas d’enregistrer tant que rien n’a changé', () => {
    render(<PhotoTitleEditor photo={photo()} />);

    expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument();
  });

  it('enregistre le nouveau titre', () => {
    render(<PhotoTitleEditor photo={photo()} />);

    fireEvent.change(screen.getByLabelText('photos.name.label'), {
      target: { value: 'Fissure mur nord' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ photoId: 'p1', name: 'Fissure mur nord' });
  });

  /**
   * Un nom vide effacerait le seul repère d'une photo, et le serveur le refuse
   * (`name` est requis). Le refuser ici évite un aller-retour pour rien.
   */
  it('refuse un titre vide plutôt que d’effacer le repère de la photo', () => {
    render(<PhotoTitleEditor photo={photo()} />);

    fireEvent.change(screen.getByLabelText('photos.name.label'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
  });

  it('n’écrit rien tant qu’on n’a pas enregistré', () => {
    render(<PhotoTitleEditor photo={photo()} />);

    fireEvent.change(screen.getByLabelText('photos.name.label'), { target: { value: 'x' } });

    expect(mutate).not.toHaveBeenCalled();
  });

  it('annuler ramène au nom du serveur', () => {
    render(<PhotoTitleEditor photo={photo()} />);

    fireEvent.change(screen.getByLabelText('photos.name.label'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(screen.getByLabelText('photos.name.label')).toHaveValue('IMG_4312.jpg');
  });

  it('suit la photo courante quand la visionneuse change d’image', () => {
    const { rerender } = render(<PhotoTitleEditor photo={photo()} />);

    rerender(<PhotoTitleEditor photo={photo({ id: 'p2', name: 'IMG_9000.jpg' })} />);

    // Sans réalignement, enregistrer aurait donné à la photo suivante le nom de la
    // précédente — exactement le défaut que `PhotoZonesEditor` avait déjà payé.
    expect(screen.getByLabelText('photos.name.label')).toHaveValue('IMG_9000.jpg');
  });
});
