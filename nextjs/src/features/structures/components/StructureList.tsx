import { Mail, Phone } from "lucide-react";

import type { Structure } from "../types";
import RepertoireListItem, {
  type RepertoireListItemAction,
  type RepertoireListItemMetadata,
} from "@shared/components/RepertoireListItem";

type StructureListProps = {
  structures: Structure[];
  onSelect: (structure: Structure) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
};

function normalizeValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function getPrimaryStructureEmail(structure: Structure) {
  const candidate = structure.emails.find((email) => email.is_primary) ?? structure.emails[0];
  const value = normalizeValue(candidate?.email);
  return value ?? null;
}

function getPrimaryStructurePhone(structure: Structure) {
  const candidate = structure.phones.find((phone) => phone.is_primary) ?? structure.phones[0];
  const value = normalizeValue(candidate?.phone);
  return value ?? null;
}

export default function StructureList({ structures, onSelect, t }: StructureListProps) {
  if (structures.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        {t("structures.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <ul className="divide-y divide-gray-100">
        {structures.map((structure) => {
          const name = normalizeValue(structure.name) ?? t("structures.unnamedStructure");
          const type = normalizeValue(structure.type);
          const website = normalizeValue(structure.website);
          const tags =
            structure.tags
              ?.map((tag) => normalizeValue(tag))
              .filter((tag): tag is string => Boolean(tag)) ?? [];

          const primaryEmail = getPrimaryStructureEmail(structure);
          const primaryPhone = getPrimaryStructurePhone(structure);

          const metadata: RepertoireListItemMetadata[] = [];
          if (type) {
            metadata.push({ label: type, variant: "text" });
          }
          if (website) {
            metadata.push({ label: website, variant: "text" });
          }
          tags.forEach((tag) => metadata.push({ label: tag, variant: "badge" }));

          const actions: RepertoireListItemAction[] = [];
          if (primaryEmail) {
            actions.push({
              icon: Mail,
              ariaLabel: t("structures.emailAction", { name }),
              href: `mailto:${primaryEmail}`,
            });
          }
          if (primaryPhone) {
            actions.push({
              icon: Phone,
              ariaLabel: t("structures.phoneAction", { name }),
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
                detailAriaLabel={t("structures.viewDetails", { name })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
