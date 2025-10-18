import type { Contact, ContactAddress, ContactEmail, ContactPhone } from "../types";

export function formatFullName(contact: Pick<Contact, "first_name" | "last_name">) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
}

export function getPrimaryEmail(contact: Contact): ContactEmail | null {
  return contact.emails.find((email) => email.is_primary) ?? contact.emails[0] ?? null;
}

export function getPrimaryPhone(contact: Contact): ContactPhone | null {
  return contact.phones.find((phone) => phone.is_primary) ?? contact.phones[0] ?? null;
}

export function formatAddress(address: ContactAddress) {
  const line1 = address.address_1;
  const line2 = [address.zipcode, address.city].filter(Boolean).join(" ");
  const line3 = address.country;
  return [line1, line2, line3].filter((line) => !!line && line.trim().length > 0).join("\n");
}
