"use client";

import { useMemo, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { Building2, CalendarDays, Globe, MapPin, Pencil, Phone, StickyNote, Tag, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useStructures } from "@structures/hooks/useStructures";
import { useContacts } from "@contacts/hooks/useContacts";
import StructureDeleteButton from "@structures/components/StructureDeleteButton";
import EntityInteractionsCard from "@/components/EntityInteractionsCard";
import { useStructureInteractions } from "@structures/hooks/useStructureInteractions";
import { formatFullName } from "@contacts/lib/format";
import type { Structure, StructureAddress } from "@structures/types";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

type Translator = (key: string, values?: Record<string, unknown>) => string;

function normalizeUrl(url?: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatStructureAddress(address: StructureAddress) {
  const lines: string[] = [];
  if (address.address_1?.trim()) lines.push(address.address_1.trim());
  if (address.address_2?.trim()) lines.push(address.address_2.trim());

  const cityLine = [address.zipcode, address.city].filter((value) => value && value.trim().length > 0).join(" ");
  if (cityLine.trim()) lines.push(cityLine.trim());

  if (address.country?.trim()) lines.push(address.country.trim());
  return lines.join("\n");
}

function StructureDetails({ structure, t }: { structure: Structure; t: Translator }) {
  const createdAt = structure.created_at ? new Date(structure.created_at).toLocaleString() : null;
  const updatedAt = structure.updated_at ? new Date(structure.updated_at).toLocaleString() : null;
  const safeWebsite = normalizeUrl(structure.website);
  const sections: { key: string; content: ReactNode }[] = [];

  if (structure.addresses.length > 0) {
    sections.push({
      key: "addresses",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
            {t("structures.addresses")}
          </div>
          <ul className="mt-2 space-y-3 text-sm text-foreground">
            {structure.addresses.map((address) => (
              <li key={address.id} className="flex items-start justify-between gap-3">
                <div className="whitespace-pre-line">
                  {formatStructureAddress(address)}
                  {address.label ? (
                    <div className="mt-1 text-xs text-muted-foreground">{address.label}</div>
                  ) : null}
                </div>
                {address.is_primary ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {t("structures.primary")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  if (structure.emails.length > 0) {
    sections.push({
      key: "emails",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Mail className="h-4 w-4" aria-hidden />
            {t("structures.emails")}
          </div>
          <ul className="mt-2 space-y-2 text-sm text-foreground">
            {structure.emails.map((email) => (
              <li key={email.id} className="flex items-start justify-between gap-3">
                <div>
                  <div className="break-all">{email.email}</div>
                  {email.label ? <div className="text-xs text-muted-foreground">{email.label}</div> : null}
                </div>
                {email.is_primary ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {t("structures.primary")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  if (structure.phones.length > 0) {
    sections.push({
      key: "phones",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Phone className="h-4 w-4" aria-hidden />
            {t("structures.phones")}
          </div>
          <ul className="mt-2 space-y-2 text-sm text-foreground">
            {structure.phones.map((phone) => (
              <li key={phone.id} className="flex items-start justify-between gap-3">
                <div>
                  <div>{phone.phone}</div>
                  {phone.label ? <div className="text-xs text-muted-foreground">{phone.label}</div> : null}
                </div>
                {phone.is_primary ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {t("structures.primary")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  if (structure.description) {
    sections.push({
      key: "description",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <StickyNote className="h-4 w-4" aria-hidden />
            {t("structures.description")}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{structure.description}</p>
        </div>
      ),
    });
  }

  if (structure.tags && structure.tags.length > 0) {
    sections.push({
      key: "tags",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Tag className="h-4 w-4" aria-hidden />
            {t("structures.tags")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {structure.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (structure.website) {
    sections.push({
      key: "website",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Globe className="h-4 w-4" aria-hidden />
            {t("structures.website")}
          </div>
          <div className="mt-2 text-sm text-foreground">
            {safeWebsite ? (
              <a
                href={safeWebsite}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary underline-offset-2 hover:underline"
              >
                {structure.website}
              </a>
            ) : (
              <span className="break-all">{structure.website}</span>
            )}
          </div>
        </div>
      ),
    });
  }

  if (createdAt || updatedAt) {
    sections.push({
      key: "metadata",
      content: (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {t("structures.metadata")}
          </div>
          <dl className="mt-2 space-y-1 text-sm text-foreground">
            {createdAt ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-muted-foreground">{t("structures.createdAt")}</dt>
                <dd>{createdAt}</dd>
              </div>
            ) : null}
            {updatedAt ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-muted-foreground">{t("structures.updatedAt")}</dt>
                <dd>{updatedAt}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ),
    });
  }

  if (sections.length === 0) {
    return (
      <div className="rounded border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
        {t("structures.noDetails")}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      {sections.map((section, index) => (
        <div key={section.key} className="p-4">
          {index > 0 ? <Separator className="mb-4" /> : null}
          {section.content}
        </div>
      ))}
    </section>
  );
}

export default function StructureDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const { t } = useI18n();
  const { structures, loading, error, deleteStructure } = useStructures();
  const { contacts } = useContacts();

  const structureIdParam = params?.id;
  const structureId = Array.isArray(structureIdParam) ? structureIdParam[0] : structureIdParam ?? "";

  const structure = useMemo(
    () => structures.find((item) => item.id === structureId) ?? null,
    [structures, structureId]
  );

  const linkedContacts = useMemo(() => {
    if (!structure) return [];
    return contacts.filter((contact) => contact.structure_id === structure.id);
  }, [contacts, structure]);

  const {
    interactions: recentInteractions,
    documentCounts,
    loading: interactionsLoading,
    error: interactionsError,
  } = useStructureInteractions(structure?.id ?? null, { limit: 5 });

  const moreInteractionsHref = structure
    ? `/app/interactions?structureId=${structure.id}${structure.name ? `&structureName=${encodeURIComponent(
      structure.name
    )}` : ""}`
    : undefined;

  const actions = useMemo(
    () =>
      structure
        ? [
          {
            icon: Pencil,
            href: `/app/structures/${structure.id}/edit`,
            label: t("structures.editTitle"),
          } as const,
        ]
        : undefined,
    [structure, t]
  );

  const isNotFound = Boolean(structureId) && !loading && !structure;

  return (
    <DetailPageLayout
      title={structure ? structure.name || t("structures.unnamedStructure") : t("structures.detailFallbackTitle")}
      subtitle={t("structures.detailSubtitle")}
      context={structure?.type ?? undefined}
      actions={actions}
      loading={loading}
      error={error ?? null}
      errorTitle={t("structures.loadFailed")}
      isNotFound={isNotFound}
      notFoundState={
        <EmptyState
          icon={Building2}
          title={t("structures.notFound")}
          description={t("structures.detailSubtitle")}
          action={
            <Button asChild variant="outline">
              <LinkWithOverlay href="/app/repertoire?view=structures">{t("structures.title")}</LinkWithOverlay>
            </Button>
          }
        />
      }
      className="max-w-4xl"
      contentClassName="space-y-6"
    >
      {structure ? (
        <div className="space-y-6">
          <StructureDetails structure={structure} t={t} />

          <section className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("structures.linkedContacts")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("structures.linkedContactsDescription")}</p>
            </div>

            {linkedContacts.length === 0 ? (
              <p className="mt-4 rounded border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                {t("structures.noLinkedContacts")}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border/60">
                {linkedContacts.map((contact) => {
                  const name = formatFullName(contact) || t("contacts.unnamedContact");
                  return (
                    <li key={contact.id}>
                      <LinkWithOverlay
                        href={`/app/contacts/${contact.id}`}
                        className="flex items-center justify-between px-2 py-3 text-sm transition hover:bg-muted/60"
                      >
                        <span className="font-medium text-foreground">{name}</span>
                        <span className="text-xs text-primary">{t("structures.viewContact")}</span>
                      </LinkWithOverlay>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <EntityInteractionsCard
              title={t("structures.latestInteractionsTitle")}
              subtitle={t("structures.latestInteractionsSubtitle")}
              interactions={recentInteractions}
              documentCounts={documentCounts}
              loading={interactionsLoading}
              error={interactionsError}
              moreHref={moreInteractionsHref}
              t={t}
            />
          </section>

          <div className="flex justify-end">
            <StructureDeleteButton structure={structure} onDelete={() => deleteStructure(structure.id)} />
          </div>
        </div>
      ) : null}
    </DetailPageLayout>
  );
}
