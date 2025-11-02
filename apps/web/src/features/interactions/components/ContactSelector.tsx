"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useContacts } from "@contacts/hooks/useContacts";
import type { Contact } from "@contacts/types";

type ContactSelectorProps = {
  householdId: string;
  value: string[];
  onChange: (next: string[]) => void;
};

function formatContactName(contact: Contact) {
  const first = contact.first_name?.trim() ?? "";
  const last = contact.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || contact.id;
}

export default function ContactSelector({ householdId, value, onChange }: ContactSelectorProps) {
  const { t } = useI18n();
  const { contacts, loading, error, setError, createContact } = useContacts();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => value.includes(contact.id)),
    [contacts, value]
  );

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const term = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const full = formatContactName(contact).toLowerCase();
      const structureName = contact.structure?.name?.toLowerCase() ?? "";
      return full.includes(term) || structureName.includes(term) || (contact.position ?? "").toLowerCase().includes(term);
    });
  }, [contacts, search]);

  const toggleContact = (contactId: string) => {
    const exists = value.includes(contactId);
    if (exists) {
      onChange(value.filter((id) => id !== contactId));
    } else {
      onChange([...value, contactId]);
    }
  };

  const handleRemove = (contactId: string) => {
    onChange(value.filter((id) => id !== contactId));
  };

  const resetCreateForm = () => {
    setFirstName("");
    setLastName("");
    setPosition("");
    setCreateError("");
  };

  const handleCreateContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreateError("");
    try {
      setCreating(true);
      const contact = await createContact({
        householdId,
        firstName,
        lastName,
        position,
      });
      resetCreateForm();
      if (contact && !value.includes(contact.id)) {
        onChange([...value, contact.id]);
      }
      setShowCreate(false);
    } catch (createErr) {
      console.error(createErr);
      const message = createErr instanceof Error ? createErr.message : t("contacts.createFailed");
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {selectedContacts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedContacts.map((contact) => (
            <li key={contact.id}>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {formatContactName(contact)}
                <button
                  type="button"
                  onClick={() => handleRemove(contact.id)}
                  className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-700 hover:bg-indigo-200"
                  aria-label={t("interactionscontacts.removeContact", { name: formatContactName(contact) })}
                >
                  {t("common.remove")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">{t("interactionscontacts.noneSelected")}</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          {t("interactionscontacts.openPicker")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowCreate(true)}>
          {t("interactionscontacts.createInline")}
        </Button>
      </div>

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) {
            setSearch("");
            setError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("interactionscontacts.dialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("interactionscontacts.searchPlaceholder")}
            />

            {loading ? (
              <p className="text-sm text-gray-500">{t("common.loading")}</p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-sm text-gray-500">{t("interactionscontacts.noResults")}</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredContacts.map((contact) => {
                  const isSelected = value.includes(contact.id);
                  const structure = contact.structure;
                  const description = structure
                    ? `${structure.name}${structure.type ? ` • ${structure.type}` : ""}`
                    : contact.position ?? "";
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleContact(contact.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{formatContactName(contact)}</p>
                          {description ? <p className="text-xs text-gray-500 truncate">{description}</p> : null}
                        </div>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-500 text-white"
                              : "border-gray-300 bg-white text-gray-400"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected ? "✓" : "+"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
              {t("common.close")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                setShowCreate(true);
              }}
            >
              {t("interactionscontacts.quickCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("interactionscontacts.createTitle")}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateContact}>
            {createError && <p className="text-xs text-red-600">{createError}</p>}

            <div className="space-y-2">
              <label htmlFor="inline-contact-first-name" className="text-sm font-medium text-gray-700">
                {t("interactionscontacts.firstName")}
              </label>
              <Input
                id="inline-contact-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder={t("interactionscontacts.firstNamePlaceholder")}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="inline-contact-last-name" className="text-sm font-medium text-gray-700">
                {t("interactionscontacts.lastName")}
              </label>
              <Input
                id="inline-contact-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder={t("interactionscontacts.lastNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="inline-contact-position" className="text-sm font-medium text-gray-700">
                {t("interactionscontacts.position")}
              </label>
              <Input
                id="inline-contact-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder={t("interactionscontacts.positionPlaceholder")}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? t("common.saving") : t("interactionscontacts.saveContact")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
