import * as React from 'react';
import { Search, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ListPage from '@/components/ListPage';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { FilterPill } from '@/design-system/filter-pill';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSessionState } from '@/lib/useSessionState';
import {
  ATTENTION_KEYS,
  EQUIPMENT_CATEGORIES,
  type AttentionKey,
  type EquipmentListItem,
} from '@/lib/api/equipment';
import {
  useEquipmentList,
  useEquipmentAttention,
  useDeleteEquipment,
  useLogEquipmentService,
} from './hooks';
import EquipmentCard from './EquipmentCard';
import EquipmentDialog from './EquipmentDialog';
import EquipmentPurchaseDialog from './EquipmentPurchaseDialog';
import ZonePicker from '@/features/zones/ZonePicker';

const STATUS_OPTIONS = ['', 'active', 'maintenance', 'storage', 'retired', 'lost', 'ordered'];

export default function EquipmentPage() {
  const { t } = useTranslation();

  const [search, setSearch] = React.useState('');
  // La recherche s'applique en tapant. Elle exigeait « Appliquer » (ou Entrée)
  // pendant que statut et zone s'appliquaient au clic : deux modèles
  // d'interaction dans la même barre, dont un qui ne se devine pas — taper
  // « bosch » ne filtrait rien, sans que rien ne le dise.
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState('');
  const [zone, setZone] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [attention, setAttention] = useSessionState<AttentionKey | ''>('equipment.attention', '');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<EquipmentListItem | null>(null);
  const [purchasingItem, setPurchasingItem] = React.useState<EquipmentListItem | null>(null);

  const filters = React.useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(zone ? { zone } : {}),
      ...(category ? { category } : {}),
      ...(attention ? { attention } : {}),
    }),
    [debouncedSearch, status, zone, category, attention],
  );

  const { data: items = [], isLoading, error, refetch } = useEquipmentList(filters);
  const { data: counts } = useEquipmentAttention();
  const deleteEquipmentMutation = useDeleteEquipment();
  const logServiceMutation = useLogEquipmentService();

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('equipment.deleted'),
    onDelete: (id) => deleteEquipmentMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (itemId: string) => {
      deleteWithUndo(itemId);
    },
    [deleteWithUndo],
  );

  const handleLogService = React.useCallback(
    (item: EquipmentListItem) => {
      logServiceMutation.mutate({ id: item.id });
    },
    [logServiceMutation],
  );

  const hasActiveFilters = !!(search || status || zone || category || attention);

  function resetFilters() {
    setSearch('');
    setStatus('');
    setZone('');
    setCategory('');
    setAttention('');
  }

  const isEmpty = !isLoading && !error && items.length === 0 && !hasActiveFilters;
  const showSkeleton = useDelayedLoading(isLoading);

  /** Les pastilles à afficher : celles qui comptent au moins un équipement.
   *  Une pastille « 0 entretien en retard » est un reproche sans objet, et
   *  quatre pastilles vides en permanence transforment le bandeau en décor. */
  const attentionPills = ATTENTION_KEYS.filter(
    (key) => (counts?.[key] ?? 0) > 0 || attention === key,
  );

  return (
    <>
      <ListPage
        title={t('equipment.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: Wrench,
          title: t('equipment.empty_list'),
          description: t('equipment.empty_description'),
          action: { label: t('equipment.new'), onClick: () => setDialogOpen(true) },
        }}
        actions={<Button type="button" onClick={() => setDialogOpen(true)}>{t('equipment.new')}</Button>}
      >
        <div className="space-y-4">
          {/* Ce qui réclame un geste, en tête et cliquable. Le module savait déjà
              tout ça — la liste était le seul écran à ne pas le montrer. */}
          {attentionPills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {attentionPills.map((key) => (
                <FilterPill
                  key={key}
                  active={attention === key}
                  onClick={() => setAttention(attention === key ? '' : key)}
                >
                  {t(`equipment.attention.${key}`, { count: counts?.[key] ?? 0 })}
                </FilterPill>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="equipment-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('equipment.search_placeholder')}
                aria-label={t('equipment.search')}
                className="pl-8"
              />
            </div>
            {/* `Select` s'enveloppe lui-même dans un conteneur `w-full` (le
                chevron y est positionné en absolu) : la largeur se borne donc
                ici, pas par une classe passée au `<select>` — sinon le champ
                rétrécit et son chevron reste à l'autre bout de la ligne. */}
            <div className="w-52">
              <Select
                id="equipment-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t('equipment.detail.fields.category')}
              >
                <option value="">{t('equipment.all_categories')}</option>
                {EQUIPMENT_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {t(`equipment.category.${key}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select
                id="equipment-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label={t('equipment.status_label')}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s ? t(`equipment.status.${s}`) : t('equipment.all_statuses')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44 min-w-0">
              <ZonePicker
                id="equipment-zone"
                value={zone || null}
                onChange={(id) => setZone(id ?? '')}
                allowEmpty
                emptyLabel={t('equipment.all_zones')}
                placeholder={t('equipment.all_zones')}
              />
            </div>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                {t('equipment.reset')}
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {t('equipment.error_loading_list')}
              <button
                type="button"
                onClick={() => void refetch()}
                className="ml-2 underline hover:no-underline"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error ? (
            items.length === 0 ? (
              /* Vide **parce qu'on filtre** n'est pas vide : proposer « créer un
                 équipement » ici enverrait créer ce qu'on cherchait à voir. */
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('equipment.no_match')}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    onEdit={setEditingItem}
                    onDelete={handleDelete}
                    onPurchase={setPurchasingItem}
                    onLogService={handleLogService}
                    serviceInFlight={
                      logServiceMutation.isPending &&
                      logServiceMutation.variables?.id === item.id
                    }
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      </ListPage>

      <EquipmentDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <EquipmentDialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        existingItem={editingItem ?? undefined}
      />

      <EquipmentPurchaseDialog
        open={purchasingItem !== null}
        onOpenChange={(open) => { if (!open) setPurchasingItem(null); }}
        equipment={purchasingItem}
      />
    </>
  );
}
