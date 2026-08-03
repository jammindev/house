/**
 * Récupère les fichiers déposés par le service worker lors d'un partage Android.
 *
 * Le partage système envoie un POST multipart que le service worker intercepte —
 * il ne peut pas téléverser lui-même, faute de pouvoir lire `localStorage` où vit
 * le jeton. Il met donc les fichiers dans un cache, redirige ici, et c'est la page
 * qui les envoie. Ce module est le pont entre les deux.
 *
 * Le cache est **consommé** : une fois lus, les fichiers sont effacés. Sans ça, un
 * rechargement de la page renverrait les mêmes photos une seconde fois.
 */

const SHARE_CACHE = 'shared-files-v1';
const SHARE_KEY = '/__shared__';

export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];

  const cache = await caches.open(SHARE_CACHE);
  const index = await cache.match(SHARE_KEY);
  if (!index) return [];

  const count = Number.parseInt(await index.text(), 10);
  if (!Number.isFinite(count) || count <= 0) {
    await caches.delete(SHARE_CACHE);
    return [];
  }

  const files: File[] = [];
  for (let i = 0; i < count; i += 1) {
    const entry = await cache.match(`${SHARE_KEY}/${i}`);
    if (!entry) continue;
    const blob = await entry.blob();
    const rawName = entry.headers.get('x-file-name');
    const name = rawName ? decodeURIComponent(rawName) : `photo-${i + 1}.jpg`;
    files.push(new File([blob], name, { type: blob.type || 'image/jpeg' }));
  }

  // Consommé : un rechargement ne doit pas renvoyer le même lot.
  await caches.delete(SHARE_CACHE);
  return files;
}
