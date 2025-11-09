import type { ContactEmail, ContactPhone } from "@contacts/types";
import type { InteractionContact, InteractionStructure } from "@interactions/types";
import type { StructureEmail, StructurePhone } from "@structures/types";

type WithPrimaryFlag = { is_primary?: boolean | null };

function findPrimaryValue<T extends WithPrimaryFlag>(items: T[] | undefined | null) {
  if (!items?.length) return null;
  return items.find((item) => item.is_primary) ?? items[0] ?? null;
}

export function getPrimaryContactEmail(contact: InteractionContact): ContactEmail | null {
  return findPrimaryValue<ContactEmail>(contact.emails);
}

export function getPrimaryContactPhone(contact: InteractionContact): ContactPhone | null {
  return findPrimaryValue<ContactPhone>(contact.phones);
}

export function getPrimaryStructureEmail(structure: InteractionStructure): StructureEmail | null {
  return findPrimaryValue<StructureEmail>(structure.emails);
}

export function getPrimaryStructurePhone(structure: InteractionStructure): StructurePhone | null {
  return findPrimaryValue<StructurePhone>(structure.phones);
}
