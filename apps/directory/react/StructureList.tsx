
import { Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Structure } from '@/lib/api/structures';
import RepertoireListItem, {
  type RepertoireListItemAction,
  type RepertoireListItemMetadata,
} from './RepertoireListItem';

type StructureListProps = {
  structures: Structure[];
  onSelect: (structure: Structure) => void;
};

function normalizeValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function getPrimaryEmail(structure: Structure): string | null {
  const candidate = structure.emails.find((e) => e.is_primary) ?? structure.emails[0];
  return normalizeValue(candidate?.email);
}

function getPrimaryPhone(structure: Structure): string | null {
  const candidate = structure.phones.find((p) => p.is_primary) ?? structure.phones[0];
  return normalizeValue(candidate?.phone);
}

export default function StructureList({ structures, onSelect }: StructureListProps) {
  const { t } = useTranslation();

  if (structures.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        {t('structures.empty', { defaultValue: 'No structures yet.' })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <ul className="divide-y divide-gray-100">
        {structures.map((structure) => {
          const name = normalizeValue(structure.name) ?? t('structures.unnamedStructure', { defaultValue: 'Unnamed structure' });
          const type = normalizeValue(structure.type);
          const website = normalizeValue(structure.website);
          const tags = (structure.tags ?? [])
            .map((tag) => normalizeValue(tag))
            .filter((tag): tag is string => Boolean(tag));

          const primaryEmail = getPrimaryEmail(structure);
          const primaryPhone = getPrimaryPhone(structure);

          const metadata: RepertoireListItemMetadata[] = [];
          if (type) metadata.push({ label: type, variant: 'text' });
          if (website) metadata.push({ label: website, variant: 'text' });
          tags.forEach((tag) => metadata.push({ label: tag, variant: 'badge' }));

          const actions: RepertoireListItemAction[] = [];
          if (primaryEmail) {
            actions.push({
              icon: Mail,
              ariaLabel: t('structures.emailAction', { defaultValue: `Email ${name}`, name }),
              href: `mailto:${primaryEmail}`,
            });
          }
          if (primaryPhone) {
            actions.push({
              icon: Phone,
              ariaLabel: t('structures.phoneAction', { defaultValue: `Call ${name}`, name }),
              href: `tel:${primaryPhone}`,
            });
          }

          return (
            <li key={structure.id}>
              <RepertoireListItem
                title={name}
                metadata={metadata.length > 0 ? metadata : undefined}
                actions={actions}
                onSelect={() => onSelect(structure)}
                detailAriaLabel={t('structures.viewDetails', { defaultValue: `View ${name}`, name })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
