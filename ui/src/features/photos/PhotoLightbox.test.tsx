import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  /** Déplie la card info — ce qui s'y fait n'est plus visible d'emblée. */
  function expandInfo() {
    fireEvent.click(screen.getByRole('button', { name: 'photos.info.more' }));
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
    expandInfo();

    const button = screen.getByRole('button', { name: 'photos.entity.remove' });
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledWith(photos[1]);
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
  });

  it('annonce « prise le » quand l’EXIF donne la date, pas « ajoutée le »', () => {
    render(
      <PhotoLightbox
        photos={[photo('x', { created_at: '2026-07-20T10:00:00Z', taken_at: '2026-06-14T13:30:00Z' })]}
        openId="x"
        onOpenChange={onOpenChange}
        onRemove={onRemove}
        removeLabel="common.delete"
      />,
    );

    // La date de la photo est le seul fait de la card repliée : c'est elle qui situe
    // ce qu'on regarde. L'import, lui, est un détail — il attend qu'on déplie.
    expect(screen.getByText(/photos\.takenOn/)).toBeInTheDocument();
    expect(screen.queryByText(/photos\.addedOn/)).not.toBeInTheDocument();

    expandInfo();

    // Les deux dates s'écartent de plus d'un jour : l'import reste dit, mais à part.
    expect(screen.getByText(/photos\.addedOn/)).toBeInTheDocument();
  });

  it('n’annonce que « ajoutée le » quand l’EXIF ne dit rien', () => {
    render(
      <PhotoLightbox
        photos={[photo('x', { created_at: '2026-07-20T10:00:00Z', taken_at: null })]}
        openId="x"
        onOpenChange={onOpenChange}
        onRemove={onRemove}
        removeLabel="common.delete"
      />,
    );

    expect(screen.queryByText(/photos\.takenOn/)).not.toBeInTheDocument();
    expect(screen.getByText(/photos\.addedOn/)).toBeInTheDocument();
  });

  it('ne répète pas la date d’import quand elle colle à la prise de vue', () => {
    render(
      <PhotoLightbox
        photos={[photo('x', { created_at: '2026-06-14T18:00:00Z', taken_at: '2026-06-14T13:30:00Z' })]}
        openId="x"
        onOpenChange={onOpenChange}
        onRemove={onRemove}
        removeLabel="common.delete"
      />,
    );
    expandInfo();

    expect(screen.getByText(/photos\.takenOn/)).toBeInTheDocument();
    expect(screen.queryByText(/photos\.addedOn/)).not.toBeInTheDocument();
  });

  /**
   * Le geste central de la refonte plein écran : la photo occupe tout l'écran, et
   * ce qui la commente se retire au tap. Le chrome est **démonté du calque
   * d'accessibilité** (`aria-hidden`), jamais seulement transparent — sinon la
   * tabulation continuerait d'atteindre des boutons invisibles.
   */
  it('retire le chrome au tap sur la photo, et le ramène au suivant', () => {
    open('b');

    expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'photos.next' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'photos.toggleInfo' }));

    expect(screen.queryByRole('button', { name: 'common.close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'photos.next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'photos.info.more' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'photos.toggleInfo' }));

    expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'photos.info.more' })).toBeInTheDocument();
  });

  it('garde le clavier et la fermeture opérants quand le chrome est retiré', () => {
    open('b');
    fireEvent.click(screen.getByRole('button', { name: 'photos.toggleInfo' }));

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onOpenChange).toHaveBeenCalledWith('c');
  });

  /**
   * Le chrome se scinde en deux calques, et c'est tout l'objet de ce bloc : retirer
   * ce qui *commente* la photo ne doit pas retirer ce qui permet d'en changer.
   * Sans ça, la souris restait bloquée sur la photo courante — le seul moyen de
   * passer à la suivante était de rappeler la card qu'on venait justement d'écarter.
   */
  describe('la navigation revient sous la souris', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    function hideChrome() {
      fireEvent.click(screen.getByRole('button', { name: 'photos.toggleInfo' }));
    }

    it('rappelle les chevrons — et eux seuls — quand la souris bouge', () => {
      open('b');
      hideChrome();
      expect(screen.queryByRole('button', { name: 'photos.next' })).not.toBeInTheDocument();

      fireEvent.pointerMove(screen.getByRole('button', { name: 'photos.toggleInfo' }), {
        pointerType: 'mouse',
      });

      expect(screen.getByRole('button', { name: 'photos.next' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
      // La card info, elle, reste écartée : c'est ce que l'utilisateur a demandé.
      expect(screen.queryByRole('button', { name: 'photos.info.more' })).not.toBeInTheDocument();
    });

    it('les efface à nouveau après un moment d’immobilité', () => {
      open('b');
      hideChrome();
      fireEvent.pointerMove(screen.getByRole('button', { name: 'photos.toggleInfo' }), {
        pointerType: 'mouse',
      });
      expect(screen.getByRole('button', { name: 'photos.next' })).toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(2500); });

      expect(screen.queryByRole('button', { name: 'photos.next' })).not.toBeInTheDocument();
    });

    it('ignore le doigt — un tap ne doit pas faire clignoter les chevrons', () => {
      open('b');
      hideChrome();

      fireEvent.pointerMove(screen.getByRole('button', { name: 'photos.toggleInfo' }), {
        pointerType: 'touch',
      });

      expect(screen.queryByRole('button', { name: 'photos.next' })).not.toBeInTheDocument();
    });
  });

  /**
   * La card info se **replie**, et c'est le cœur du changement : on ouvre une photo
   * pour la regarder, pas pour lire quatre faits, deux éditeurs et trois boutons
   * qu'on n'a pas demandés. Repliée elle ne dit que ce qui situe la photo — titre,
   * date, et le manque de zone qui, lui, appelle un geste. Le reste attend le pli.
   */
  describe('la card info se déplie', () => {
    function renderWithEditors(over: Partial<DocumentItem> = {}) {
      return render(
        <PhotoLightbox
          photos={[photo('x', { notes: 'une note', ...over })]}
          openId="x"
          onOpenChange={onOpenChange}
          onRemove={onRemove}
          removeLabel="common.delete"
          renderTitle={() => <div>title-editor</div>}
          renderPurpose={() => <div>purpose-editor</div>}
          renderZones={() => <div>zones-editor</div>}
        />,
      );
    }

    it('ne dit que l’essentiel une fois repliée', () => {
      renderWithEditors();

      expect(screen.getByText('photo x')).toBeVisible();
      expect(screen.getByText(/photos\.addedOn/)).toBeInTheDocument();

      expect(screen.queryByText('title-editor')).not.toBeInTheDocument();
      expect(screen.queryByText('purpose-editor')).not.toBeInTheDocument();
      expect(screen.queryByText('zones-editor')).not.toBeInTheDocument();
      expect(screen.queryByText('une note')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
      expect(screen.queryByText('photos.download')).not.toBeInTheDocument();
    });

    it('donne de quoi corriger la zone et le titre une fois dépliée', () => {
      renderWithEditors();
      expandInfo();

      expect(screen.getByText('title-editor')).toBeInTheDocument();
      expect(screen.getByText('zones-editor')).toBeInTheDocument();
      expect(screen.getByText('purpose-editor')).toBeInTheDocument();
      expect(screen.getByText('une note')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
    });

    it('se replie sur un second clic', () => {
      renderWithEditors();
      expandInfo();

      fireEvent.click(screen.getByRole('button', { name: 'photos.info.less' }));

      expect(screen.queryByText('zones-editor')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'photos.info.more' })).toBeInTheDocument();
    });

    /**
     * Le pli est un geste, pas un réglage : il survit au passage à la photo suivante
     * — on corrige plusieurs photos d'affilée sans re-déplier à chaque image, même
     * raison qu'au retrait du chrome.
     */
    it('reste déplié quand on change de photo', () => {
      const { rerender } = render(
        <PhotoLightbox
          photos={photos}
          openId="a"
          onOpenChange={onOpenChange}
          onRemove={onRemove}
          removeLabel="common.delete"
          renderZones={() => <div>zones-editor</div>}
        />,
      );
      expandInfo();

      rerender(
        <PhotoLightbox
          photos={photos}
          openId="b"
          onOpenChange={onOpenChange}
          onRemove={onRemove}
          removeLabel="common.delete"
          renderZones={() => <div>zones-editor</div>}
        />,
      );

      expect(screen.getByText('zones-editor')).toBeInTheDocument();
    });

    /**
     * « Voir » ouvrait le fichier dans un onglet — la photo qu'on a déjà sous les
     * yeux, en plein écran. Un bouton qui promet ce qui est déjà là fait douter de
     * ce qu'on regarde.
     */
    it('ne propose plus « Voir » — la photo est déjà là', () => {
      renderWithEditors();
      expandInfo();

      expect(screen.queryByText('photos.view')).not.toBeInTheDocument();
    });
  });

  /**
   * La pastille « sans zone » ne disparaît pas de l'app : elle **déménage** de la
   * vignette (où elle bruitait toute la grille sans rien offrir) vers la card info,
   * réduite à son icône — à un pli du sélecteur de zones qui la corrige. C'est la
   * même règle que le `flagWithoutSupplier` des dépenses : une pastille n'avertit
   * que là où le manque est actionnable.
   */
  describe('l’icône « sans zone »', () => {
    function renderFlagged(over: Partial<DocumentItem> = {}) {
      return render(
        <PhotoLightbox
          photos={[photo('x', { zone_links: [], ...over })]}
          openId="x"
          onOpenChange={onOpenChange}
          onRemove={onRemove}
          removeLabel="common.delete"
          flagWithoutZone
        />,
      );
    }

    it('signale, repliée, une photo rangée dans aucune zone', () => {
      renderFlagged();

      // Le libellé n'est pas peint : il reste le nom accessible de l'icône.
      expect(screen.getByRole('img', { name: 'photos.withoutZone' })).toBeInTheDocument();
    });

    it('se tait dès que la photo a une zone', () => {
      renderFlagged({ zone_links: [{ zone_id: 'z1', zone_name: 'Salon' }] });

      expect(screen.queryByRole('img', { name: 'photos.withoutZone' })).not.toBeInTheDocument();
    });

    it('reste absente là où ranger n’est pas la question posée', () => {
      render(
        <PhotoLightbox
          photos={[photo('x', { zone_links: [] })]}
          openId="x"
          onOpenChange={onOpenChange}
          onRemove={onRemove}
          removeLabel="common.delete"
        />,
      );

      expect(screen.queryByRole('img', { name: 'photos.withoutZone' })).not.toBeInTheDocument();
    });

    it('ne suppose pas que le payload porte le champ', () => {
      // Une entrée encore en cache avant ce changement n'a pas de `zone_links` : la
      // pastille doit se décider, pas planter.
      renderFlagged({ zone_links: undefined as unknown as [] });

      expect(screen.getByRole('img', { name: 'photos.withoutZone' })).toBeInTheDocument();
    });
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

  /**
   * La vignette est la photo, et rien d'autre. Le nom d'un fichier d'appareil
   * (`IMG_4312.jpg`) n'apprend rien, et le peindre sur un dégradé le faisait payer
   * par **toutes** les cases de la grille : on y regarde des images, pas une liste.
   * Il reste le nom **accessible** du bouton — retiré de l'écran, pas du calque
   * d'accessibilité, où il est le seul moyen de désigner la vignette.
   */
  it('ne peint pas le nom, mais le garde comme nom accessible', () => {
    render(<PhotoThumb photo={photo('a')} onOpen={vi.fn()} />);

    expect(screen.queryByText('photo a')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'photo a' })).toBeInTheDocument();
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
