import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/lib/toast';
import {
  fetchPhotoDocuments,
  fetchPurposeCounts,
  fetchTriageQueue,
  deleteDocument,
  updateDocument,
  attachEntityDocument,
  detachEntityDocument,
  setDocumentPhase,
  setDocumentZones,
  setPhotosPurpose,
  bulkAddDocumentZones,
  entityDetailQueryKey,
  type PhotoPhase,
  type PhotoPurpose,
} from '@/lib/api/documents';
import { useInvalidate } from '@/lib/invalidate';
import { documentKeys } from '@/features/documents/hooks';
import { zoneKeys } from '@/features/zones/hooks';

export interface PhotoFilters {
  search?: string;
  zone?: string;
  /** `'1'` = seulement les photos rangées dans aucune zone. */
  without_zone?: string;
  /**
   * `technical` | `observation` | `memory` | `untriaged`.
   *
   * ⚠️ Ne jamais envoyer la chaîne vide pour dire « toutes » : le serveur refuse en
   * 400, précisément pour qu'un paramètre oublié ne se lise pas comme un filtre. Pour
   * « toutes », on **omet** la clé.
   */
  purpose?: string;
  [key: string]: string | undefined;
}

export const photoKeys = {
  all: ['photos'] as const,
  list: (filters?: PhotoFilters) => [...photoKeys.all, 'list', filters ?? {}] as const,
  /** La file « À trier », par grappes de session. */
  triage: () => [...photoKeys.all, 'triage'] as const,
  /** Les compteurs des pastilles d'intention. */
  purposeCounts: () => [...photoKeys.all, 'purposeCounts'] as const,
  /** Photos linked to one entity (project, equipment…) — the detail Photos tab. */
  entity: (entityType: string, objectId: string) =>
    [...photoKeys.all, 'entity', entityType, objectId] as const,
};

/**
 * `enabled` sert à **ne pas** charger la galerie à plat quand l'écran affiche la file
 * de tri : la liste n'est pas paginée, et « à trier » désigne au premier jour toute la
 * photothèque (rien n'a été backfillé). La file, elle, est bornée par le serveur.
 */
export function usePhotos(filters?: PhotoFilters, enabled = true) {
  return useQuery({
    queryKey: photoKeys.list(filters),
    queryFn: () => fetchPhotoDocuments(filters),
    enabled,
  });
}

/**
 * La file « À trier » — le serveur groupe les photos en sessions, pas le client.
 *
 * Le compteur de la pastille et le lot qu'on applique doivent sortir de la même
 * fonction : une grappe recalculée ici finirait par ne plus désigner les mêmes
 * photos que celle que le serveur a comptée.
 */
export function useTriageQueue(enabled = true) {
  return useQuery({
    queryKey: photoKeys.triage(),
    queryFn: fetchTriageQueue,
    enabled,
  });
}

/** Les compteurs des pastilles — une requête à part, bon marché, toujours à jour. */
export function usePurposeCounts() {
  return useQuery({
    queryKey: photoKeys.purposeCounts(),
    queryFn: fetchPurposeCounts,
  });
}

/**
 * Range une grappe : pose une intention sur un lot de photos.
 *
 * Le toast dit combien de photos ont bougé **et** combien gardaient leur intention —
 * sur un lot, « enregistré » sans nombre ne se vérifie pas, l'écran venant justement
 * de vider ce qu'on regardait.
 */
export function useSetPhotosPurpose() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({
      photoIds,
      purpose,
      overwrite,
    }: {
      photoIds: string[];
      purpose: PhotoPurpose;
      overwrite?: boolean;
    }) => setPhotosPurpose(photoIds, purpose, { overwrite }),
    onSuccess: ({ updated, skipped }) => {
      invalidate('photos');
      toast({
        description: skipped
          ? t('photos.purpose.savedWithSkipped', { count: updated, skipped })
          : t('photos.purpose.saved', { count: updated }),
        variant: 'success',
      });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Pose (ou retire) l'intention d'une seule photo. */
export function useSetPhotoPurpose() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ photoId, purpose }: { photoId: string; purpose: PhotoPurpose | '' }) =>
      updateDocument(photoId, { purpose }),
    onSuccess: () => {
      invalidate('photos');
      toast({ description: t('photos.purpose.savedOne'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      // Les photos sont des `Document` : la liste documents doit bouger aussi,
      // sinon la corbeille d'un écran contredit l'autre.
      void qc.invalidateQueries({ queryKey: photoKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: () => toast({ description: t('common.deleteFailed'), variant: 'destructive' }),
  });
}

/**
 * Range une photo : remplace ses zones.
 *
 * Invalide large — galerie, documents, **et** zones. Ranger une photo change le
 * `tab_counts.photos` de la zone d'arrivée comme celui de la zone de départ, et
 * l'onglet Photos d'une zone lit la même liste : n'invalider que les photos
 * laisserait deux écrans se contredire sur la même donnée.
 */
export function useSetPhotoZones() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ photoId, zoneIds }: { photoId: string; zoneIds: string[] }) =>
      setDocumentZones(photoId, zoneIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: photoKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      void qc.invalidateQueries({ queryKey: zoneKeys.all });
      toast({ description: t('photos.zones.saved'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/**
 * Range un lot de photos : **ajoute** les zones choisies à chacune.
 *
 * Le toast dit combien de photos ont bougé — sur un lot, « enregistré » sans
 * nombre ne se vérifie pas : l'écran vient justement de vider sa sélection.
 */
export function useAddPhotosZones() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ photoIds, zoneIds }: { photoIds: string[]; zoneIds: string[] }) =>
      bulkAddDocumentZones(photoIds, zoneIds),
    onSuccess: ({ updated }) => {
      void qc.invalidateQueries({ queryKey: photoKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      void qc.invalidateQueries({ queryKey: zoneKeys.all });
      toast({ description: t('photos.zones.bulkSaved', { count: updated }), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// ── Entity-scoped photos (detail page « Photos » tab) ──────────────────────

/** Photos linked to a single entity, with their phase in that context. */
export function useEntityPhotos(entityType: string, objectId: string) {
  return useQuery({
    queryKey: photoKeys.entity(entityType, objectId),
    queryFn: () => fetchPhotoDocuments({ [entityType]: objectId }),
    enabled: !!objectId,
  });
}

/** Invalidate the entity photos list + the entity detail (its photos tab count). */
function useEntityPhotoInvalidation(entityType: string, objectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: photoKeys.entity(entityType, objectId) });
    void qc.invalidateQueries({ queryKey: photoKeys.all });
    // Une photo EST un `Document` : attacher/détacher change aussi ses backlinks.
    void qc.invalidateQueries({ queryKey: documentKeys.all });
    // tab_counts.photos lives on the linked entity's detail (project, chicken…).
    const detailKey = entityDetailQueryKey(entityType);
    if (detailKey) void qc.invalidateQueries({ queryKey: detailKey });
  };
}

export function useAttachEntityPhoto(entityType: string, objectId: string) {
  const invalidate = useEntityPhotoInvalidation(entityType, objectId);
  return useMutation({
    mutationFn: ({ documentId, phase }: { documentId: string; phase?: PhotoPhase | '' }) =>
      attachEntityDocument(entityType, objectId, documentId, phase),
    onSuccess: invalidate,
  });
}

export function useDetachEntityPhoto(entityType: string, objectId: string) {
  const invalidate = useEntityPhotoInvalidation(entityType, objectId);
  return useMutation({
    mutationFn: (documentId: string) => detachEntityDocument(entityType, objectId, documentId),
    onSuccess: invalidate,
  });
}

export function useSetPhotoPhase(entityType: string, objectId: string) {
  const invalidate = useEntityPhotoInvalidation(entityType, objectId);
  return useMutation({
    mutationFn: ({ documentId, phase }: { documentId: string; phase: PhotoPhase | '' }) =>
      setDocumentPhase(entityType, objectId, documentId, phase),
    onSuccess: invalidate,
  });
}
