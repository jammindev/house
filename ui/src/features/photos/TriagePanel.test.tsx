import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TriagePanel from './TriagePanel';
import PhotoPurposeEditor from './PhotoPurposeEditor';
import type { DocumentItem, TriageQueue } from '@/lib/api/documents';

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

const sortCluster = vi.fn();
const sortOne = vi.fn();
let queue: TriageQueue | undefined;

vi.mock('./hooks', async () => {
  const actual = await vi.importActual<typeof import('./hooks')>('./hooks');
  return {
    ...actual,
    useTriageQueue: () => ({ data: queue, isLoading: false, error: null, refetch: vi.fn() }),
    useSetPhotosPurpose: () => ({ mutate: sortCluster, isPending: false }),
    useSetPhotoPurpose: () => ({ mutate: sortOne, isPending: false }),
  };
});

function photo(id: string): DocumentItem {
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

function cluster(key: string, ids: string[]) {
  return {
    key,
    start: '2026-07-10T09:00:00Z',
    end: '2026-07-10T11:00:00Z',
    count: ids.length,
    photos: ids.map(photo),
  };
}

beforeEach(() => {
  sortCluster.mockClear();
  sortOne.mockClear();
  queue = { total: 3, clusters: [cluster('c1', ['p1', 'p2', 'p3'])] };
});

/**
 * Le tri se fait **par grappe**. Une file qui demande trente gestes pour trente photos
 * ne se vide jamais, et une file qu'on ne vide jamais cesse d'être lue.
 */
describe('TriagePanel', () => {
  it('range toute une grappe en un seul geste', () => {
    render(<TriagePanel onPhotoClick={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /photos\.purpose\.memory/ }));

    expect(sortCluster).toHaveBeenCalledTimes(1);
    expect(sortCluster.mock.calls[0][0]).toEqual({
      photoIds: ['p1', 'p2', 'p3'],
      purpose: 'memory',
    });
  });

  it('propose les trois intentions, et jamais « à trier » comme quatrième', () => {
    render(<TriagePanel onPhotoClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /photos\.purpose\.technical/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /photos\.purpose\.observation/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /photos\.purpose\.memory/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /photos\.purpose\.untriaged/ })).toBeNull();
  });

  it('dit ce qui reste quand la file est plus longue que ce qu’elle montre', () => {
    // Le serveur borne sa fenêtre : annoncer le compte de l'écran ferait croire la
    // file finie alors que d'autres grappes attendent.
    queue = { total: 120, clusters: [cluster('c1', ['p1', 'p2', 'p3'])] };

    render(<TriagePanel onPhotoClick={vi.fn()} />);

    expect(screen.getByText(/photos\.triage\.remainingPartial:120,3/)).toBeTruthy();
  });

  it('annonce une file vide, jamais une galerie vide', () => {
    queue = { total: 0, clusters: [] };

    render(<TriagePanel onPhotoClick={vi.fn()} />);

    expect(screen.getByText('photos.triage.empty')).toBeTruthy();
  });
});

/**
 * ⚠️ Le vide n'est pas un souvenir. Une photo non triée doit le **dire** : « aucune
 * pastille allumée » se lirait sinon comme un défaut d'affichage.
 */
describe('PhotoPurposeEditor', () => {
  it('dit qu’une photo n’a pas encore été triée', () => {
    render(<PhotoPurposeEditor photo={{ ...photo('p1'), purpose: '' }} />);

    expect(screen.getByText('photos.purpose.none')).toBeTruthy();
  });

  it('ne dit pas « non triée » d’un souvenir', () => {
    render(<PhotoPurposeEditor photo={{ ...photo('p1'), purpose: 'memory' }} />);

    expect(screen.queryByText('photos.purpose.none')).toBeNull();
  });

  it('recliquer sur l’intention posée la retire', () => {
    render(<PhotoPurposeEditor photo={{ ...photo('p1'), purpose: 'memory' }} />);

    fireEvent.click(screen.getByRole('button', { name: /photos\.purpose\.memory/ }));

    expect(sortOne).toHaveBeenCalledWith({ photoId: 'p1', purpose: '' });
  });

  it('pose l’intention cliquée quand la photo n’en a pas', () => {
    render(<PhotoPurposeEditor photo={{ ...photo('p1'), purpose: '' }} />);

    fireEvent.click(screen.getByRole('button', { name: /photos\.purpose\.technical/ }));

    expect(sortOne).toHaveBeenCalledWith({ photoId: 'p1', purpose: 'technical' });
  });
});
