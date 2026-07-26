import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/design-system/select';
import { useProjects } from '@/features/projects/hooks';
import { useEquipmentList } from '@/features/equipment/hooks';
import { useStockItems } from '@/features/stock/hooks';

import type { AllocationSource, AllocationSourceType } from './allocationSource';

interface AllocationSourceSelectProps {
  idPrefix: string;
  value: AllocationSource;
  onChange: (next: AllocationSource) => void;
}

/**
 * « Rattacher à » — l'axe *objet* d'une ligne de ventilation (parcours 26, lot 3).
 *
 * Budget et projet sont deux axes **indépendants** : 90 € des 150 € dépensés chez
 * Leroy Merlin comptent dans le chantier salle de bain *et* dans l'enveloppe
 * « Bricolage ». Sans ce champ le côté projet n'existerait pas du tout —
 * `projects.services` agrège les coûts par la FK polymorphe et par rien d'autre.
 *
 * Deux `Select` plutôt qu'une liste unique de tous les objets du foyer : choisir le
 * type d'abord évite de charger équipements et stock quand on ne veut qu'un projet,
 * et garde une liste lisible sur un foyer bien rempli.
 */
export default function AllocationSourceSelect({
  idPrefix,
  value,
  onChange,
}: AllocationSourceSelectProps) {
  const { t } = useTranslation();

  // Trois requêtes pour tout le dialog, pas trois par ligne : React Query dédoublonne
  // par clé, donc les N lignes d'un découpage partagent le même cache.
  const projectsQuery = useProjects();
  const equipmentQuery = useEquipmentList();
  const stockQuery = useStockItems();

  const options = React.useMemo(() => {
    if (value.type === 'projects.project') {
      return (projectsQuery.data ?? []).map((p) => ({ value: p.id, label: p.title }));
    }
    if (value.type === 'equipment.equipment') {
      return (equipmentQuery.data ?? []).map((e) => ({ value: e.id, label: e.name }));
    }
    if (value.type === 'stock.stockitem') {
      return (stockQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }));
    }
    return [];
  }, [value.type, projectsQuery.data, equipmentQuery.data, stockQuery.data]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        id={`${idPrefix}-source-type`}
        value={value.type}
        // Changer de type vide l'id : garder l'ancien produirait une référence
        // valide dans le mauvais modèle, qui passerait la validation serveur.
        onChange={(e) =>
          onChange({ type: e.target.value as AllocationSourceType | '', id: '' })
        }
        options={[
          { value: '', label: t('banking.allocation.source.none') },
          { value: 'projects.project', label: t('banking.allocation.source.project') },
          { value: 'equipment.equipment', label: t('banking.allocation.source.equipment') },
          { value: 'stock.stockitem', label: t('banking.allocation.source.stock') },
        ]}
      />

      {value.type ? (
        <Select
          id={`${idPrefix}-source-id`}
          value={value.id}
          onChange={(e) => onChange({ type: value.type, id: e.target.value })}
          options={[
            { value: '', label: t('banking.allocation.source.pick') },
            ...options,
          ]}
        />
      ) : null}
    </div>
  );
}
