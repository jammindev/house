import * as React from 'react';
import { ChevronRight, FolderKanban, Layers, ListTodo, Pencil, Trash2, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import CardActions, { type CardAction } from '@/components/CardActions';
import { pushBack } from '@/lib/backNavigation';
import { cn } from '@/lib/utils';
import type { ZoneTreeRow } from './hooks';
import type { Zone } from '@/lib/api/zones';

/** Largeur d'un niveau d'indentation, en px. Assez pour un coude lisible. */
const GUIDE_WIDTH = 16;

interface MetaChipProps {
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
}

/**
 * Compteur de contenu. Rendu seulement quand il y a quelque chose à dire : une
 * ligne de zéros ne porte aucune information et ruine la densité gagnée.
 */
function MetaChip({ icon: Icon, count, label }: MetaChipProps) {
  if (!count) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Les traits de l'arborescence. Le coude vit dans la dernière colonne
 * (`depth - 1`) ; les colonnes précédentes ne portent qu'un trait vertical de
 * passage, dont la présence est dictée par `guides`.
 *
 * `guides[j]` = « l'ancêtre au niveau j a-t-il encore un frère après lui ? ».
 * La colonne `j` d'une ligne de profondeur `d` reflète donc `guides[j + 1]`.
 */
function TreeGuides({ depth, guides, isLast }: { depth: number; guides: boolean[]; isLast: boolean }) {
  if (depth === 0) return null;
  return (
    <>
      {Array.from({ length: depth }, (_, column) => {
        const isElbowColumn = column === depth - 1;
        const showPassThrough = !isElbowColumn && guides[column + 1];
        return (
          <span
            key={column}
            aria-hidden="true"
            className="relative h-9 shrink-0"
            style={{ width: GUIDE_WIDTH }}
          >
            {showPassThrough ? (
              <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
            ) : null}
            {isElbowColumn ? (
              <>
                {/* Segment vertical : du haut jusqu'au centre, puis jusqu'en bas
                    si d'autres frères suivent. */}
                <span
                  className={cn('absolute left-1/2 top-0 w-px bg-border', isLast ? 'h-1/2' : 'h-full')}
                />
                {/* Segment horizontal vers la ligne. */}
                <span className="absolute left-1/2 top-1/2 h-px w-1/2 bg-border" />
              </>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

interface ZoneRowProps {
  row: ZoneTreeRow;
  collapsed: boolean;
  onToggle: (zoneId: string) => void;
  onEdit: (zone: Zone) => void;
  onDelete: (zone: Zone) => void;
}

export default function ZoneRow({ row, collapsed, onToggle, onEdit, onDelete }: ZoneRowProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { zone, depth, hasChildren, isLast, guides } = row;

  const childCount = zone.children_count ?? 0;
  const displayColor = zone.color || '#94a3b8';

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(zone) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(zone), variant: 'danger' },
  ];

  return (
    <div className="group flex h-9 items-center px-2 transition-colors hover:bg-muted/60 sm:px-3">
      <TreeGuides depth={depth} guides={guides} isLast={isLast} />

      {/* Chevron de pliage — emplacement réservé même sans enfants, pour que les
          noms d'un même niveau restent alignés. */}
      <span className="flex h-9 w-6 shrink-0 items-center justify-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(zone.id)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('zones.expandZone') : t('zones.collapseZone')}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform', !collapsed && 'rotate-90')}
            />
          </button>
        ) : null}
      </span>

      <span
        aria-hidden="true"
        className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
        style={{ backgroundColor: displayColor }}
      />

      {/* Les traits de l'arborescence sont purement visuels : le lecteur d'écran
          reçoit la hiérarchie par le chemin complet servi par l'API. */}
      <Link
        to={`/app/zones/${zone.id}`}
        state={pushBack(location)}
        aria-label={depth > 0 ? zone.full_path : undefined}
        className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-primary hover:underline"
      >
        {zone.name}
      </Link>

      {/* Méta-infos — les compteurs de la zone elle-même, jamais du sous-arbre :
          un total roulé serait ambigu face à l'onglet du détail. */}
      <div className="ml-2 flex shrink-0 items-center gap-2.5 sm:gap-3">
        {zone.surface != null ? (
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
            {t('zones.surfaceShort', { value: zone.surface })}
          </span>
        ) : null}
        <MetaChip
          icon={Layers}
          count={childCount}
          label={t('zones.meta.children', { count: childCount })}
        />
        <MetaChip
          icon={Wrench}
          count={zone.equipment_count ?? 0}
          label={t('zones.meta.equipment', { count: zone.equipment_count ?? 0 })}
        />
        <MetaChip
          icon={ListTodo}
          count={zone.open_task_count ?? 0}
          label={t('zones.meta.tasks', { count: zone.open_task_count ?? 0 })}
        />
        <MetaChip
          icon={FolderKanban}
          count={zone.active_project_count ?? 0}
          label={t('zones.meta.projects', { count: zone.active_project_count ?? 0 })}
        />
      </div>

      {/* Les actions restent montées (et donc atteignables au clavier) mais ne
          se révèlent au survol que sur pointeur fin — sur tactile il n'y a pas
          de survol, donc elles y sont toujours visibles. */}
      <div className="ml-1 shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <CardActions actions={actions} />
      </div>
    </div>
  );
}
