"use client";

import { useRouter } from "next/navigation";

import DeleteWithConfirmButton from "@/components/DeleteWithConfirmButton";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useDeleteContact } from "@contacts/hooks/useDeleteContact";
import { formatFullName } from "@contacts/lib/format";
import type { Contact } from "@contacts/types";

type ContactDeleteButtonProps = {
  contact: Contact;
  onDeleted?: () => void;
};

export default function ContactDeleteButton({ contact, onDeleted }: ContactDeleteButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const deleteContact = useDeleteContact();
  const contactName = formatFullName(contact) || t("contacts.unnamedContact");

  const handleSuccess = () => {
    onDeleted?.();
    router.push("/app/repertoire?view=contacts&deleted=1");
  };

  return (
    <DeleteWithConfirmButton
      onConfirm={() => deleteContact(contact.id)}
      onSuccess={handleSuccess}
      buttonLabel={t("contacts.deleteContact")}
      loadingLabel={t("common.deleting")}
      confirmTitle={t("contacts.deleteTitle")}
      confirmDescription={t("contacts.deleteDescription", { name: contactName })}
      confirmActionLabel={t("contacts.deleteConfirmCta")}
      cancelLabel={t("common.cancel")}
      successToast={{ title: t("contacts.deleteSuccess"), variant: "success" }}
      errorFallback={t("contacts.deleteFailed")}
    />
  );
}
