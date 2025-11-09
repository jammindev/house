// nextjs/src/features/interactions/components/detail/InteractionAssociations.tsx
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { InteractionContact, InteractionStructure, InteractionTag } from "@interactions/types";
import ContactAssociationChip from "./ContactAssociationChip";
import StructureAssociationChip from "./StructureAssociationChip";

type InteractionAssociationsProps = {
  tags: InteractionTag[];
  contacts: InteractionContact[];
  structures: InteractionStructure[];
  className?: string;
};

export default function InteractionAssociations({
  tags,
  contacts,
  structures,
  className,
}: InteractionAssociationsProps) {
  const { t } = useI18n();

  if (!tags.length && !contacts.length && !structures.length) {
    return null;
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors",
        className,
      )}
    >
      {tags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("interactionstagsLabel")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`tag-${tag.id}`}
                className="inline-flex items-center rounded-full border border-border/40 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {contacts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("interactionscontacts.sectionTitle")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <ContactAssociationChip key={`contact-${contact.id}`} contact={contact} t={t} />
            ))}
          </div>
        </div>
      )}

      {structures.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("interactionsstructures.sectionTitle")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {structures.map((structure) => (
              <StructureAssociationChip
                key={`structure-${structure.id}`}
                structure={structure}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
