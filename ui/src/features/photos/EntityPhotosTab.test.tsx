import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EntityPhotosTab from './EntityPhotosTab';
import type { DocumentItem } from '@/lib/api/documents';

// jsdom n'implémente pas `matchMedia`, dont dépend `useIsMobile` sous l'onglet.
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

// Les deux dialogs sont réduits à un marqueur : ce qui compte ici est
// *lequel* s'ouvre, pas ce qu'il contient.
vi.mock('@/features/documents/DocumentUploadDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="upload-dialog" /> : null),
}));
vi.mock('@/features/documents/EntityAttachDocumentDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="attach-dialog" /> : null),
}));

const photosRef: { current: DocumentItem[] } = { current: [] };

vi.mock('./hooks', async () => {
  const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
  const noopMutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(async () => undefined) });
  return {
    ...actual,
    useEntityPhotos: () => ({ data: photosRef.current, isLoading: false, error: null }),
    useAttachEntityPhoto: noopMutation,
    useDetachEntityPhoto: noopMutation,
    useSetPhotoPhase: noopMutation,
  };
});

function photo(id: string, over: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id,
    name: `photo ${id}`,
    file_url: `/media/${id}.jpg`,
    medium_url: `/media/medium/${id}.jpg`,
    thumbnail_url: `/media/thumb/${id}.jpg`,
    created_at: '2026-07-10T12:00:00Z',
    metadata: {},
    ...over,
  } as DocumentItem;
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EntityPhotosTab entityType="zone" objectId="z1" />
    </QueryClientProvider>,
  );
}

/**
 * Ce que ce test tient : **les deux chemins d'ajout restent joignables à vide.**
 *
 * La barre d'actions n'est rendue qu'à partir d'une photo, pour ne pas redire
 * « Ajouter une photo » juste au-dessus d'un encart qui le propose déjà. Mais
 * elle porte aussi « Choisir une existante », et l'`EmptyState` ne relayait que
 * l'upload : sur une zone sans photo, rattacher une photo déjà dans la galerie
 * du foyer était impossible — alors que c'est justement là que c'est le plus
 * utile.
 */
describe('EntityPhotosTab', () => {
  beforeEach(() => {
    photosRef.current = [];
  });

  it('propose de choisir une photo existante même quand l’entité n’en a aucune', () => {
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'photos.entity.attach_existing' }));

    expect(screen.getByTestId('attach-dialog')).toBeInTheDocument();
  });

  it('propose aussi l’import d’un nouveau fichier quand l’entité n’en a aucune', () => {
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'photos.entity.upload' }));

    expect(screen.getByTestId('upload-dialog')).toBeInTheDocument();
  });

  it('ne dit pas deux fois « ajouter une photo » quand il n’y en a aucune', () => {
    renderTab();

    expect(screen.getAllByRole('button', { name: 'photos.entity.upload' })).toHaveLength(1);
  });

  it('garde les deux boutons dans la barre dès qu’une photo existe', () => {
    photosRef.current = [photo('a')];
    renderTab();

    expect(
      screen.getByRole('button', { name: 'photos.entity.attach_existing' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'photos.entity.upload' })).toBeInTheDocument();
  });
});
