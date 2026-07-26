/**
 * L'axe « objet » d'une ligne de ventilation (parcours 26, lot 3).
 *
 * Type et constante dans leur propre module : les exporter depuis le composant
 * casserait le fast refresh de Vite (`react-refresh/only-export-components`).
 */

export type AllocationSourceType =
  | 'projects.project'
  | 'equipment.equipment'
  | 'stock.stockitem';

export interface AllocationSource {
  type: AllocationSourceType | '';
  id: string;
}

export const NO_SOURCE: AllocationSource = { type: '', id: '' };
