import type { Contact, ContactAddress, ContactEmail, ContactPhone } from "../types";

function cleanText(value?: string | null) {
  return value?.trim() ? value.trim() : "";
}

export function formatFullName(contact: Pick<Contact, "first_name" | "last_name">) {
  return [cleanText(contact.first_name), cleanText(contact.last_name)]
    .filter((part) => part.length > 0)
    .join(" ");
}

export function getPrimaryEmail(contact: Contact): ContactEmail | null {
  return contact.emails.find((email) => email.is_primary) ?? contact.emails[0] ?? null;
}

export function getPrimaryPhone(contact: Contact): ContactPhone | null {
  return contact.phones.find((phone) => phone.is_primary) ?? contact.phones[0] ?? null;
}

export function formatAddress(address: ContactAddress) {
  const line1 = cleanText(address.address_1);
  const line2 = [cleanText(address.zipcode), cleanText(address.city)].filter((part) => part.length > 0).join(" ");
  const line3 = cleanText(address.country);
  return [line1, line2, line3].filter((line) => line.length > 0).join("\n");
}
