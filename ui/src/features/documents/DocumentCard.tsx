import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckSquare,
  Egg,
  ExternalLink,
  FileText,
  FileX,
  FolderKanban,
  Link2,
  MapPin,
  Pencil,
  ScanText,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { pushBack } from '@/lib/backNavigation';
import { formatFileSize, type DocumentItem } from '@/lib/api/documents';
import { isWithoutContext } from './grouping';

/**
 * Icône par type d'entité rattachée. Volontairement **sans libellé de type** : la
 * ligne se lit « 🔧 Chaudière · 📍 Cave », et l'entité peut être de n'importe quel
 * type enregistré dans `agent.searchables` — une clé i18n construite
 * (`documents.linked_to.types.<type>`) afficherait la clé brute le jour où un
 * nouveau type devient rattachable. Le mot du type reste sur la page détail, où le
 * catalogue est complet.
 */
const ENTITY_ICONS: Record<string, LucideIcon> = {
  zone: MapPin,
  project: FolderKanban,
  equipment: Wrench,
  task: CheckSquare,
  chicken: Egg,
};

interface DocumentCardProps {
  doc: DocumentItem;
  onEdit: (doc: DocumentItem) => void;
  onDelete: (id: string) => void;
  deleteLabel?: string;
  /**
   * Affiche à quoi le document est rattaché. Faux par défaut : dans l'onglet
   * Documents d'une entité, rappeler l'entité qu'on est en train de regarder est du
   * bruit.
   */
  showEntityLinks?: boolean;
  /**
   * Masque la pastille de type. À poser quand le contexte le dit déjà — sous un
   * en-tête de section « Factures », ou quand le filtre de type est actif : répété
   * sur chaque ligne, le mot cesse d'informer et vole la place du nom du fichier.
   */
  hideType?: boolean;
}

export default function DocumentCard({
  doc,
  onEdit,
  onDelete,
  deleteLabel,
  showEntityLinks = false,
  hideType = false,
}: DocumentCardProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const fileName = doc.name || doc.file_path.split('/').pop() || '';
  const fileSize =
    typeof doc.metadata?.size === 'number' ? formatFileSize(doc.metadata.size) : null;
  const createdDate = new Date(doc.created_at).toLocaleDateString();
  const hasOcrText = Boolean(doc.ocr_text && doc.ocr_text.trim());

  // Les activités liées ont déjà leur ligne juste en dessous : les répéter ici
  // ferait dire deux fois la même chose à la même carte.
  const backlinks = React.useMemo(
    () => (doc.entity_links ?? []).filter((link) => link.entity_type !== 'interaction'),
    [doc.entity_links],
  );

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(doc) },
    { label: deleteLabel ?? t('common.delete'), icon: Trash2, onClick: () => onDelete(doc.id), variant: 'danger' },
  ];

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-4">
      {/* File icon */}
      <div className="mt-0.5 flex-shrink-0">
        {doc.file_url ? (
          <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400" aria-hidden="true" />
        ) : (
          <FileX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {/* Name + metadata */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/documents/${doc.id}`}
            state={pushBack(location)}
            className="group text-foreground hover:text-primary"
          >
            <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">{fileName}</CardTitle>
          </Link>

          {!hideType && doc.type && doc.type !== 'photo' && (
            <Badge variant="secondary" className="text-xs">
              {t(`documents.type.${doc.type}`)}
            </Badge>
          )}

          {hasOcrText && (
            <span
              className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
              title={t('documents.ocr.markerLabel')}
              aria-label={t('documents.ocr.markerLabel')}
            >
              <ScanText className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}

          {fileSize && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">{fileSize}</span>
          )}
        </div>

        {doc.notes && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{doc.notes}</p>
        )}

        {showEntityLinks && backlinks.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {backlinks.map((link) => {
              const Icon = ENTITY_ICONS[link.entity_type] ?? Link2;
              return (
                <Link
                  key={`${link.entity_type}:${link.id}`}
                  to={link.url_path}
                  state={pushBack(location)}
                  className="inline-flex max-w-full items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                >
                  <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{createdDate}</span>

          {doc.linked_interactions.length > 0 && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {doc.linked_interactions[0].subject}
            </span>
          )}

          {/* Même prédicat que la pastille « Sans contexte » de la liste — voir
              `grouping.isWithoutContext` : deux expressions du même état finissent
              par se contredire, et un badge qui démentait le compteur ferait perdre
              son crédit aux deux. */}
          {isWithoutContext(doc) && (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {t('documents.qualification.withoutActivity')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <CardActions actions={actions} />
    </li>
  );
}
