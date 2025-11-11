// nextjs/src/features/contacts/components/ContactDetailsView.tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, MapPin, Phone, StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import AuditHistoryCard from "@/components/AuditHistoryCard";
import ContactDeleteButton from "@contacts/components/ContactDeleteButton";
import { useContactInteractions } from "@contacts/hooks/useContactInteractions";
import EntityInteractionsCard from "@/components/EntityInteractionsCard";

import type { Contact } from "../types";
import { formatAddress, formatFullName } from "../lib/format";

type ContactDetailsViewProps = {
  contact: Contact;
  t: (key: string, values?: Record<string, string | number>) => string;
};

type DetailSection = {
  key: string;
  icon: ReactNode;
  label: string;
  body: ReactNode;
};

function buildSections(contact: Contact, t: ContactDetailsViewProps["t"]): DetailSection[] {
  const sections: DetailSection[] = [];

  if (contact.emails.length > 0) {
    sections.push({
      key: "emails",
      icon: <Mail className="h-4 w-4" aria-hidden />,
      label: t("contacts.emails"),
      body: (
        <ul className="mt-2 space-y-2">
          {contact.emails.map((email) => (
            <li key={email.id} className="flex items-start justify-between gap-2">
              <div>
                <div className="break-all text-sm font-medium text-foreground">{email.email}</div>
                {email.label && <div className="text-xs text-muted-foreground">{email.label}</div>}
              </div>
              {email.is_primary && (
                <Badge variant="secondary" className="text-xs">
                  {t("contacts.primary")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (contact.phones.length > 0) {
    sections.push({
      key: "phones",
      icon: <Phone className="h-4 w-4" aria-hidden />,
      label: t("contacts.phones"),
      body: (
        <ul className="mt-2 space-y-2">
          {contact.phones.map((phone) => (
            <li key={phone.id} className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-foreground">{phone.phone}</div>
                {phone.label && <div className="text-xs text-muted-foreground">{phone.label}</div>}
              </div>
              {phone.is_primary && (
                <Badge variant="secondary" className="text-xs">
                  {t("contacts.primary")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (contact.addresses.length > 0) {
    sections.push({
      key: "addresses",
      icon: <MapPin className="h-4 w-4" aria-hidden />,
      label: t("contacts.addresses"),
      body: (
        <ul className="mt-2 space-y-3">
          {contact.addresses.map((address) => (
            <li key={address.id} className="flex items-start justify-between gap-2">
              <div className="whitespace-pre-line text-sm text-foreground">
                {formatAddress(address)}
                {address.label && <div className="mt-1 text-xs text-muted-foreground">{address.label}</div>}
              </div>
              {address.is_primary && (
                <Badge variant="secondary" className="text-xs">
                  {t("contacts.primary")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (contact.notes && contact.notes.trim().length > 0) {
    sections.push({
      key: "notes",
      icon: <StickyNote className="h-4 w-4" aria-hidden />,
      label: t("contacts.notes"),
      body: <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{contact.notes}</p>,
    });
  }

  return sections;
}

export default function ContactDetailsView({ contact, t }: ContactDetailsViewProps) {
  const sections = buildSections(contact, t);
  const fullName = formatFullName(contact) || t("contacts.unnamedContact");
  const {
    interactions: recentInteractions,
    documentCounts,
    loading: interactionsLoading,
    error: interactionsError,
  } = useContactInteractions(contact.id, { limit: 5 });
  const moreInteractionsHref = `/app/interactions?contactId=${contact.id}${fullName ? `&contactName=${encodeURIComponent(fullName)}` : ""
    }`;
  const auditLines = [
    contact.created_at
      ? t("contacts.auditCreated", {
        date: new Date(contact.created_at).toLocaleString(),
      })
      : null,
    contact.updated_at
      ? t("contacts.auditUpdated", {
        date: new Date(contact.updated_at).toLocaleString(),
      })
      : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">{fullName}</CardTitle>
          {contact.position && <p className="text-sm text-muted-foreground">{contact.position}</p>}
          {contact.structure?.name && (
            <Badge variant="outline" className="mt-2 w-fit uppercase tracking-wide">
              {contact.structure.name}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {sections.length === 0 ? (
            <p className="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              {t("contacts.noDetails")}
            </p>
          ) : (
            sections.map((section, index) => (
              <div key={section.key} className="py-2">
                {index > 0 && <Separator className="mb-4 mt-2" />}
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.icon}
                  {section.label}
                </div>
                <div className="text-sm text-foreground">{section.body}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <EntityInteractionsCard
        title={t("contacts.latestInteractionsTitle")}
        subtitle={t("contacts.latestInteractionsSubtitle")}
        interactions={recentInteractions}
        documentCounts={documentCounts}
        loading={interactionsLoading}
        error={interactionsError}
        moreHref={moreInteractionsHref}
        t={t}
      />
      <AuditHistoryCard
        lines={auditLines}
        actions={<ContactDeleteButton contact={contact} />}
      />
    </div>
  );
}
