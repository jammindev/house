import { useI18n } from "@/lib/i18n/I18nProvider";
import { formatContactLabel, formatStructureLabel } from "@interactions/lib/formatParticipants";
import type { InteractionContact, InteractionStructure, InteractionTag } from "@interactions/types";

type InteractionAssociationsProps = {
  tags: InteractionTag[];
  contacts: InteractionContact[];
  structures: InteractionStructure[];
};

export default function InteractionAssociations({ tags, contacts, structures }: InteractionAssociationsProps) {
  const { t } = useI18n();

  if (!tags.length && !contacts.length && !structures.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white/70 p-4 space-y-4">
      {tags.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{t("interactionstagsLabel")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`tag-${tag.id}`}
                className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{t("interactionscontacts.sectionTitle")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <span
                key={`contact-${contact.id}`}
                className="inline-flex items-center rounded-md bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
              >
                {formatContactLabel(contact)}
              </span>
            ))}
          </div>
        </div>
      )}

      {structures.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{t("interactionsstructures.sectionTitle")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {structures.map((structure) => (
              <span
                key={`structure-${structure.id}`}
                className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                {formatStructureLabel(structure)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
