import { describe, it, expect, vi, beforeEach } from 'vitest';
import { takeSharedFiles } from './sharedFiles';

/**
 * Ce que ces tests tiennent :
 *
 * 1. **Le lot se consomme.** Le service worker dépose les fichiers dans un cache et
 *    redirige ; si la page ne vidait pas ce cache, un simple rechargement renverrait
 *    les mêmes photos une seconde fois — des doublons que personne n'a demandés, et
 *    du quota consommé pour rien.
 * 2. **Le nom du fichier survit au passage par le cache.** Il voyage dans un en-tête
 *    parce qu'une `Response` ne porte pas de nom : sans lui, toutes les photos
 *    partagées s'appelleraient pareil, et le lot deviendrait illisible dans la
 *    galerie — c'est exactement la règle « chaque document garde le nom de son
 *    fichier » du téléversement multiple.
 * 3. **Rien de partagé n'est un cas normal**, pas une erreur : ouvrir l'URL de
 *    partage à la main ne doit pas casser.
 */

const store = new Map<string, Response>();
let deleted = false;

const fakeCaches = {
  open: vi.fn(async () => ({
    match: vi.fn(async (key: string) => store.get(key)),
    put: vi.fn(async (key: string, value: Response) => {
      store.set(key, value);
    }),
  })),
  delete: vi.fn(async () => {
    deleted = true;
    store.clear();
    return true;
  }),
};

vi.stubGlobal('caches', fakeCaches);

function stash(files: { name: string; body: string; type?: string }[]) {
  store.set('/__shared__', new Response(String(files.length)));
  files.forEach((file, index) => {
    store.set(
      `/__shared__/${index}`,
      new Response(file.body, {
        headers: {
          'content-type': file.type ?? 'image/jpeg',
          'x-file-name': encodeURIComponent(file.name),
        },
      }),
    );
  });
}

describe('récupérer les fichiers déposés par le partage système', () => {
  beforeEach(() => {
    store.clear();
    deleted = false;
  });

  it('rend les fichiers partagés, avec leur nom', async () => {
    stash([
      { name: 'IMG_0001.jpg', body: 'a' },
      { name: 'photo de vacances.jpg', body: 'b' },
    ]);

    const files = await takeSharedFiles();

    expect(files.map((f) => f.name)).toEqual(['IMG_0001.jpg', 'photo de vacances.jpg']);
    expect(files[0].type).toBe('image/jpeg');
  });

  it('vide le cache après lecture — un rechargement ne renvoie pas le même lot', async () => {
    stash([{ name: 'a.jpg', body: 'a' }]);

    await takeSharedFiles();

    expect(deleted).toBe(true);
    expect(await takeSharedFiles()).toEqual([]);
  });

  it('ne casse pas quand rien n’a été partagé', async () => {
    expect(await takeSharedFiles()).toEqual([]);
  });

  it('traite un index absurde comme un lot vide', async () => {
    store.set('/__shared__', new Response('pas un nombre'));

    expect(await takeSharedFiles()).toEqual([]);
  });
});
