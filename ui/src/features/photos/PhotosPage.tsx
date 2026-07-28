import * as React from 'react';
import { Camera, CheckSquare, MapPin, MapPinOff, SearchX, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import EmptyState from '@/components/EmptyState';
import LoadError from '@/components/LoadError';
import CardActions, { type CardAction } from '@/components/CardActions';
import SelectionBar from '@/components/SelectionBar';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { Input } from '@/design-system/input';
import { Label } from '@/design-system/label';
import ZonePicker from '@/features/zones/ZonePicker';
import DocumentUploadDialog from '@/features/documents/DocumentUploadDialog';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useMultiSelect } from '@/lib/useMultiSelect';
import { useSessionState } from '@/lib/useSessionState';
import { formatMonthYear } from '@/lib/format';
import type { DocumentItem } from '@/lib/api/documents';
import { usePhotos, useDeletePhoto, photoKeys } from './hooks';
import PhotoGrid, { PhotoGridSkeleton } from './PhotoGrid';
import PhotoLightbox from './PhotoLightbox';
import PhotoZonesEditor from './PhotoZonesEditor';
import PhotoZonesDialog from './PhotoZonesDialog';
import PhotoZonesBulkDialog from './PhotoZonesBulkDialog';
import { groupPhotosByMonth } from './grouping';

export default function PhotosPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [zone, setZone] = useSessionState<string>('photos.zone', '');
  const [withoutZone, setWithoutZone] = useSessionState<boolean>('photos.withoutZone', false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [zonesFor, setZonesFor] = React.useState<DocumentItem | null>(null);

  // Une frappe ne vaut pas une requête : la recherche partait à chaque caractère.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const hasFilters = debouncedSearch !== '' || zone !== '' || withoutZone;

  const filters = React.useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(zone ? { zone } : {}),
      ...(withoutZone ? { without_zone: '1' } : {}),
    }),
    [debouncedSearch, zone, withoutZone],
  );

  const { data: photos = [], isLoading, error } = usePhotos(filters);
  const deletePhotoMutation = useDeletePhoto();

  // La portée de la sélection, ce sont les filtres : les changer vide les cases
  // cochées, sinon le lot suivant porterait sur des photos plus à l'écran.
  const photoIds = React.useMemo(() => photos.map((p) => p.id), [photos]);
  const selection = useMultiSelect(photoIds, { scopeKey: JSON.stringify(filters) });
  const [bulkZonesOpen, setBulkZonesOpen] = React.useState(false);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('photos.deleted'),
    onDelete: (id) => deletePhotoMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (photo: DocumentItem) => {
      setOpenId(null);
      const listKey = photoKeys.list(filters);
      deleteWithUndo(photo.id, {
        onRemove: () =>
          qc.setQueryData<DocumentItem[]>(listKey, (old) => old?.filter((p) => p.id !== photo.id)),
        onRestore: () =>
          qc.setQueryData<DocumentItem[]>(listKey, (old) => (old ? [...old, photo] : [photo])),
      });
    },
    [deleteWithUndo, qc, filters],
  );

  const resetFilters = React.useCallback(() => {
    setSearch('');
    setZone('');
    setWithoutZone(false);
  }, [setZone, setWithoutZone]);

  // « Dans le salon » et « dans aucune zone » ne peuvent pas être vrais ensemble :
  // les cumuler ne rendrait jamais qu'une liste vide, sans dire pourquoi.
  const toggleWithoutZone = React.useCallback(() => {
    const next = !withoutZone;
    setWithoutZone(next);
    if (next) setZone('');
  }, [withoutZone, setWithoutZone, setZone]);

  const handleZoneFilterChange = React.useCallback(
    (id: string | null) => {
      setZone(id ?? '');
      if (id) setWithoutZone(false);
    },
    [setZone, setWithoutZone],
  );

  const renderActions = React.useCallback(
    (photo: DocumentItem) => {
      const actions: CardAction[] = [
        {
          label: t('photos.zones.assign'),
          icon: MapPin,
          onClick: () => setZonesFor(photo),
        },
        {
          label: t('common.delete'),
          icon: Trash2,
          onClick: () => handleDelete(photo),
          variant: 'danger',
        },
      ];
      return <CardActions actions={actions} />;
    },
    [t, handleDelete],
  );

  const groups = React.useMemo(() => groupPhotosByMonth(photos), [photos]);
  const showSkeleton = useDelayedLoading(isLoading);

  // `ListPage` masque ses enfants quand la liste est vide — donc la barre de
  // filtres avec. On ne lui déclare « vide » que la galerie réellement vide :
  // sinon une recherche sans résultat effaçait le champ qui l'a produite, et il
  // devenait impossible de revenir en arrière.
  const isTrulyEmpty = !isLoading && !error && photos.length === 0 && !hasFilters;
  const isNoResults = !isLoading && !error && photos.length === 0 && hasFilters;

  return (
    <>
      <ListPage
        title={t('photos.title')}
        isEmpty={isTrulyEmpty}
        emptyState={{
          icon: Camera,
          title: t('photos.empty'),
          description: t('photos.empty_description'),
          action: { label: t('photos.upload_title'), onClick: () => setUploadOpen(true) },
        }}
        actions={
          <>
            {/* Rien à cocher = pas de mode sélection à proposer. */}
            {photos.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => (selection.active ? selection.exit() : selection.enter())}
                className="gap-1.5"
              >
                <CheckSquare className="h-4 w-4" aria-hidden />
                {selection.active ? t('common.cancel') : t('common.select')}
              </Button>
            ) : null}
            <Button type="button" onClick={() => setUploadOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" aria-hidden />
              {t('photos.upload_title')}
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1 sm:max-w-xs">
            <Label htmlFor="photos-search">{t('photos.search')}</Label>
            <Input
              id="photos-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('photos.search_placeholder')}
            />
          </div>
          <div className="flex-1 space-y-1 sm:max-w-xs">
            <Label htmlFor="photos-zone">{t('photos.filter.zone')}</Label>
            <ZonePicker
              id="photos-zone"
              value={zone || null}
              onChange={handleZoneFilterChange}
              allowEmpty
              emptyLabel={t('photos.filter.allZones')}
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterPill active={withoutZone} onClick={toggleWithoutZone}>
              <MapPinOff className="h-3 w-3" aria-hidden />
              {t('photos.filter.withoutZone')}
            </FilterPill>
            {hasFilters ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                {t('photos.filter.reset')}
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <LoadError
            message={t('photos.loadFailed')}
            onRetry={() => void qc.invalidateQueries({ queryKey: photoKeys.all })}
            retryLabel={t('common.retry')}
          />
        ) : showSkeleton ? (
          <PhotoGridSkeleton />
        ) : isNoResults ? (
          <EmptyState
            icon={SearchX}
            title={t('common.noResults')}
            description={t('photos.noResults_description')}
            action={{ label: t('photos.filter.reset'), onClick: resetFilters }}
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} className="space-y-2">
                <h2 className="text-sm font-medium capitalize text-muted-foreground">
                  {formatMonthYear(group.anchor)}{' '}
                  <span className="tabular-nums">({group.photos.length})</span>
                </h2>
                <PhotoGrid
                  photos={group.photos}
                  onPhotoClick={(p) => setOpenId(p.id)}
                  // Pas de menu d'actions en mode sélection : il disputerait le clic
                  // à la coche, sur une cible de la taille du pouce.
                  renderActions={selection.active ? undefined : renderActions}
                  flagWithoutZone
                  onToggleSelected={
                    selection.active ? (photo) => selection.toggle(photo.id) : undefined
                  }
                  isSelected={(photo) => selection.isSelected(photo.id)}
                />
              </section>
            ))}

            {selection.active ? (
              <SelectionBar
                label={t('photos.selection.selected', { count: selection.count })}
                allSelected={selection.allSelected}
                onToggleAll={selection.allSelected ? selection.clear : selection.selectAll}
                onExit={selection.exit}
              >
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={selection.count === 0}
                  onClick={() => setBulkZonesOpen(true)}
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  {t('photos.zones.assign')}
                </Button>
              </SelectionBar>
            ) : null}
          </div>
        )}
      </ListPage>

      <PhotoLightbox
        photos={photos}
        openId={openId}
        onOpenChange={setOpenId}
        onRemove={handleDelete}
        removeLabel={t('common.delete')}
        renderZones={(photo) => <PhotoZonesEditor photo={photo} />}
      />

      <PhotoZonesDialog photo={zonesFor} onOpenChange={(open) => { if (!open) setZonesFor(null); }} />

      <PhotoZonesBulkDialog
        open={bulkZonesOpen}
        onOpenChange={setBulkZonesOpen}
        photoIds={selection.selectedIds}
        onSaved={selection.exit}
      />

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: photoKeys.all })}
        forcedType="photo"
      />
    </>
  );
}
