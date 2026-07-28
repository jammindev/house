import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoLightbox from './PhotoLightbox';
import PhotoThumb from './PhotoThumb';
import type { DocumentItem } from '@/lib/api/documents';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

function photo(id: string, over: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id,
    name: `photo ${id}`,
    file_url: `/media/${id}.jpg`,
    medium_url: `/media/medium/${id}.jpg`,
    thumbnail_url: `/media/thumb/${id}.jpg`,
    created_at: '2026-07-10T12:00:00Z',
    metadata: { size: 204800 },
    ...over,
  } as DocumentItem;
}

const photos = [photo('a'), photo('b'), photo('c')];

/**
 * Ce que ces tests tiennent, et pourquoi :
 *
 * 1. **Une seule croix de fermeture.** `DialogContent` rend la sienne en
 *    `absolute right-4 top-4` ; l'ancien panneau en ajoutait une seconde dans son
 *    en-tête. Sur mobile celle de Radix tombait sur l'image sombre en
 *    `text-foreground`, donc invisible — et sur desktop on en voyait deux.
 * 2. **La galerie se parcourt sans fermer.** Les flèches et le clavier ← → sont
 *    la raison d'être de la refonte : avant, voir dix photos coûtait dix
 *    ouvertures.
 * 3. **Le libellé destructif est fourni par l'appelant.** Dans un onglet d'entité
 *    l'action *détache* ; annoncer « Supprimer » y était un mensonge.
 * 4. **Une image cassée le dit.** L'ancien `onError` posait `display:none` et le
 *    repli vivait dans une branche jamais atteinte : un carré vide, muet.
 */
describe('PhotoLightbox', () => {
  let onOpenChange: Mock<(id: string | null) => void>;
  let onRemove: Mock<(photo: DocumentItem) => void>;

  beforeEach(() => {
    onOpenChange = vi.fn<(id: string | null) => void>();
    onRemove = vi.fn<(photo: DocumentItem) => void>();
  });

  function open(openId: string, removeLabel = 'common.delete') {
    return render(
      <PhotoLightbox
        photos={photos}
        openId={openId}
        onOpenChange={onOpenChange}
        onRemove={onRemove}
        removeLabel={removeLabel}
      />,
    );
  }

  it('n’affiche qu’UN seul bouton de fermeture', () => {
    open('a');
    // La croix par défaut de Radix expose « Close » en `sr-only` ; la nôtre porte
    // `aria-label="common.close"`. Une seule des deux doit exister.
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1);
  });

  it('ne rend rien quand aucune photo n’est ouverte', () => {
    render(
      <PhotoLightbox
        photos={photos}
        openId={null}
        onOpenChange={onOpenChange}
        onRemove={onRemove}
        removeLabel="common.delete"
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigue vers la photo suivante et précédente', () => {
    open('b');

    fireEvent.click(screen.getByRole('button', { name: 'photos.next' }));
    expect(onOpenChange).toHaveBeenCalledWith('c');

    fireEvent.click(screen.getByRole('button', { name: 'photos.previous' }));
    expect(onOpenChange).toHaveBeenCalledWith('a');
  });

  it('navigue au clavier avec les flèches', () => {
    open('b');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onOpenChange).toHaveBeenCalledWith('c');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onOpenChange).toHaveBeenCalledWith('a');
  });

  it('masque la flèche qui mènerait hors de la collection', () => {
    open('a');
    expect(screen.queryByRole('button', { name: 'photos.previous' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'photos.next' })).toBeInTheDocument();
  });

  it('annonce la position dans la collection', () => {
    open('b');
    expect(screen.getByText('photos.position:2,3')).toBeInTheDocument();
  });

  it('rend le libellé destructif fourni par l’appelant, jamais un « supprimer » deviné', () => {
    open('b', 'photos.entity.remove');

    const button = screen.getByRole('button', { name: 'photos.entity.remove' });
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledWith(photos[1]);
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
  });

  it('affiche un repli explicite quand l’image ne charge pas', () => {
    open('a');

    const image = screen.getByAltText('photo a');
    fireEvent.error(image);

    expect(screen.getByText('photos.thumbFailed')).toBeInTheDocument();
    expect(screen.queryByAltText('photo a')).not.toBeInTheDocument();
  });
});

describe('PhotoThumb', () => {
  it('remplace la vignette cassée par un repli, au lieu de laisser un carré vide', () => {
    render(<PhotoThumb photo={photo('a')} onOpen={vi.fn()} />);

    const image = screen.getByAltText('photo a');
    fireEvent.error(image);

    expect(screen.queryByAltText('photo a')).not.toBeInTheDocument();
    expect(screen.getByText('photos.thumbFailed')).toBeInTheDocument();
  });

  it('affiche le nom sans exiger un survol — au doigt, il n’y en a pas', () => {
    render(<PhotoThumb photo={photo('a')} onOpen={vi.fn()} />);
    expect(screen.getByText('photo a')).toBeVisible();
  });

  it('porte la pastille de phase quand le contexte en fournit une', () => {
    const { rerender } = render(<PhotoThumb photo={photo('a')} onOpen={vi.fn()} phase="before" />);
    expect(screen.getByText('photos.phase.before')).toBeInTheDocument();

    rerender(<PhotoThumb photo={photo('a')} onOpen={vi.fn()} phase="" />);
    expect(screen.getByText('photos.phase.unclassified')).toBeInTheDocument();

    rerender(<PhotoThumb photo={photo('a')} onOpen={vi.fn()} />);
    expect(screen.queryByText(/photos\.phase\./)).not.toBeInTheDocument();
  });
});
