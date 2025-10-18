"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Globe, Tag, StickyNote, CalendarDays } from "lucide-react";

import type { Structure } from "../types";

type StructureDetailsDialogProps = {
  structure: Structure | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
};

function normalizeUrl(url?: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function StructureDetailsDialog({ structure, open, onOpenChange, t }: StructureDetailsDialogProps) {
  const createdAt = structure?.created_at ? new Date(structure.created_at).toLocaleString() : null;
  const updatedAt = structure?.updated_at ? new Date(structure.updated_at).toLocaleString() : null;
  const safeWebsite = normalizeUrl(structure?.website);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {structure && (
        <DialogContent className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-none p-0 sm:rounded-lg">
          <DialogHeader className="border-b border-gray-100 px-4 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {structure.name?.trim() || t("structures.unnamedStructure")}
            </DialogTitle>
            {structure.type && (
              <DialogDescription className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="h-4 w-4 text-gray-400" aria-hidden />
                <span>{structure.type}</span>
              </DialogDescription>
            )}
          </DialogHeader>

          {(() => {
            const sections: { key: string; content: ReactNode }[] = [];

            if (structure.description && structure.description.trim().length > 0) {
              sections.push({
                key: "description",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <StickyNote className="h-4 w-4" aria-hidden />
                      {t("structures.description")}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{structure.description}</p>
                  </div>
                ),
              });
            }

            if (structure.tags && structure.tags.length > 0) {
              sections.push({
                key: "tags",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Tag className="h-4 w-4" aria-hidden />
                      {t("structures.tags")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {structure.tags.map((tag) => (
                        <span key={tag} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              });
            }

            if (structure.website && structure.website.trim().length > 0) {
              sections.push({
                key: "website",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Globe className="h-4 w-4" aria-hidden />
                      {t("structures.website")}
                    </div>
                    <div className="mt-2 text-sm text-gray-800">
                      {safeWebsite ? (
                        <a
                          href={safeWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-primary-600 underline-offset-2 hover:underline"
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
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      {t("structures.metadata")}
                    </div>
                    <dl className="mt-2 space-y-1 text-sm text-gray-700">
                      {createdAt && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="font-medium text-gray-600">{t("structures.createdAt")}</dt>
                          <dd>{createdAt}</dd>
                        </div>
                      )}
                      {updatedAt && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="font-medium text-gray-600">{t("structures.updatedAt")}</dt>
                          <dd>{updatedAt}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ),
              });
            }

            if (sections.length === 0) {
              return (
                <section className="px-4 py-6 text-center text-sm text-gray-500">
                  {t("structures.noDetails")}
                </section>
              );
            }

            return (
              <section className="px-4 py-4 text-sm text-gray-700">
                {sections.map((section, index) => (
                  <div key={section.key} className="py-2">
                    {index > 0 && <Separator className="mb-4 mt-2" />}
                    {section.content}
                  </div>
                ))}
              </section>
            );
          })()}

          <DialogFooter className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <DialogClose asChild>
              <Button variant="secondary" className="w-full">
                {t("common.close")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
