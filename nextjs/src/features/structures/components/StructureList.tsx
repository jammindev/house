import { ChevronRight, Globe, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Structure } from "../types";

type StructureListProps = {
  structures: Structure[];
  onSelect: (structure: Structure) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export default function StructureList({ structures, onSelect, t }: StructureListProps) {
  if (structures.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        {t("structures.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100">
        {structures.map((structure, index) => {
          const isFirst = index === 0;
          const name = structure.name?.trim() || t("structures.unnamedStructure");
          const type = structure.type?.trim();
          const website = structure.website?.trim();
          const tags = structure.tags ?? [];

          return (
            <li key={structure.id}>
              <button
                type="button"
                onClick={() => onSelect(structure)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  isFirst ? "rounded-t-md" : ""
                )}
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="text-sm font-medium text-gray-900">{name}</div>

                  {(type || website) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {type && <span>{type}</span>}
                      {website && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                          <span className="break-all">{website}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-gray-400">
                        <Tag className="h-3 w-3" aria-hidden />
                        {t("structures.tags")}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span key={tag} className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
