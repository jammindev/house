// nextjs/src/features/interactions/components/detail/StructureAssociationChip.tsx
"use client";

import { Building2, Mail, Phone } from "lucide-react";

import { ActionChip, type ActionChipAction } from "@/components/ui/action-chip";
import { getPrimaryStructureEmail, getPrimaryStructurePhone } from "@interactions/lib/participantContacts";
import { formatStructureLabel } from "@interactions/lib/formatParticipants";
import type { InteractionStructure } from "@interactions/types";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

type StructureAssociationChipProps = {
  structure: InteractionStructure;
  t: TranslateFn;
};

export default function StructureAssociationChip({ structure, t }: StructureAssociationChipProps) {
  const label = formatStructureLabel(structure);
  const primaryEmail = getPrimaryStructureEmail(structure);
  const primaryPhone = getPrimaryStructurePhone(structure);

  const helperText = t("interactionassociations.actions.chooseAction");
  const closeLabel = t("common.close");

  const actions: ActionChipAction[] = [
    {
      key: "call",
      label: t("interactionassociations.actions.call"),
      description: primaryPhone?.phone ?? t("interactionassociations.actions.noPhone"),
      href: primaryPhone ? `tel:${primaryPhone.phone}` : undefined,
      icon: Phone,
      disabled: !primaryPhone,
    },
    {
      key: "email",
      label: t("interactionassociations.actions.email"),
      description: primaryEmail?.email ?? t("interactionassociations.actions.noEmail"),
      href: primaryEmail ? `mailto:${primaryEmail.email}` : undefined,
      icon: Mail,
      disabled: !primaryEmail,
    },
    {
      key: "view",
      label: t("interactionassociations.actions.viewProfile"),
      description: t("interactionassociations.actions.viewStructure"),
      href: `/app/structures/${structure.id}`,
      icon: Building2,
    },
  ];

  return (
    <ActionChip
      label={label}
      actions={actions}
      helperText={helperText}
      closeLabel={closeLabel}
      variant="structure"
    />
  );
}
