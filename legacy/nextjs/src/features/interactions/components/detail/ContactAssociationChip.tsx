// nextjs/src/features/interactions/components/detail/ContactAssociationChip.tsx
"use client";

import { IdCard, Mail, Phone } from "lucide-react";

import { ActionChip, type ActionChipAction } from "@/components/ui/action-chip";
import { getPrimaryContactEmail, getPrimaryContactPhone } from "@interactions/lib/participantContacts";
import { formatContactLabel } from "@interactions/lib/formatParticipants";
import type { InteractionContact } from "@interactions/types";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

type ContactAssociationChipProps = {
  contact: InteractionContact;
  t: TranslateFn;
};

export default function ContactAssociationChip({ contact, t }: ContactAssociationChipProps) {
  const label = formatContactLabel(contact);
  const primaryEmail = getPrimaryContactEmail(contact);
  const primaryPhone = getPrimaryContactPhone(contact);

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
      description: t("interactionassociations.actions.viewContact"),
      href: `/app/contacts/${contact.id}`,
      icon: IdCard,
    },
  ];

  return (
    <ActionChip
      label={label}
      actions={actions}
      helperText={helperText}
      closeLabel={closeLabel}
      variant="contact"
    />
  );
}
