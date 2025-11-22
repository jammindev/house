"use client";

import { ExternalLink, Link as LinkIcon, MapPin, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PhotoDocument } from "@photos/types";
import { formatFileSize, getDocumentFileSize } from "@interactions/utils/formatFileSize";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

type PhotoDetailsPanelProps = {
  photo: PhotoDocument;
  previewUrl?: string;
  downloadUrl?: string;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function PhotoDetailsPanel({ photo, previewUrl, downloadUrl }: PhotoDetailsPanelProps) {
  const { t } = useI18n();
  const fileSizeLabel = formatFileSize(getDocumentFileSize(photo));
  const hasZones = photo.zones.length > 0;
  const hasLinks = photo.links.length > 0;

  return (
    <article className="flex h-full flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {photo.name || t("documents.untitledDocument")}
        </h3>
        <p className="text-xs text-gray-500">
          {t("photos.addedOn", { date: formatDate(photo.created_at) })}
          {fileSizeLabel ? ` · ${fileSizeLabel}` : ""}
        </p>
      </div>

      {photo.notes && photo.notes.trim() ? (
        <p className="text-sm text-gray-700 leading-relaxed">{photo.notes}</p>
      ) : null}

      {hasZones && (
        <div className="space-y-1 text-xs text-gray-500">
          <div className="inline-flex items-center gap-1 font-medium text-gray-600">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {t("photos.linkedZones")}
          </div>
          <div className="flex flex-wrap gap-2">
            {photo.zones.map((zone) => (
              <Badge key={zone.id} variant="outline" className="border-gray-200 text-gray-700">
                {zone.name || t("zones.unnamedZone")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasLinks && (
        <div className="space-y-1 text-xs text-gray-500">
          <div className="inline-flex items-center gap-1 font-medium text-gray-600">
            <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t("photos.linkedInteractions")}
          </div>
          <div className="flex flex-wrap gap-2">
            {photo.links.map((link) => (
              <LinkWithOverlay
                key={link.interactionId}
                href={`/app/interactions/${link.interactionId}`}
                className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700 transition hover:border-primary-300 hover:bg-primary-100"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                {link.subject || t("documents.interactionNoSubject")}
              </LinkWithOverlay>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {previewUrl ? (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("photos.view")}
            </a>
          </Button>
        ) : null}
        {downloadUrl ? (
          <Button asChild size="sm" className="flex-1">
            <a href={downloadUrl}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("photos.download")}
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
