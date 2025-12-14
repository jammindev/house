"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { DocumentType } from "@interactions/types";
import type { StagedFile } from "../hooks/useDocumentUpload";
import { formatFileSize } from "../utils/uploadHelpers";
import { useIsMobile } from "../hooks/useIsMobile";

type StagedFileItemProps = {
  staged: StagedFile;
  typeOptions: Array<{ value: DocumentType; label: string }>;
  onUpdate: (changes: Partial<Pick<StagedFile, "name" | "type">>) => void;
  onRemove: () => void;
};

export function StagedFileItem({ staged, typeOptions, onUpdate, onRemove }: StagedFileItemProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();

  return (
    <div className={`flex flex-col rounded-lg border border-gray-200 bg-gray-50 ${isMobile ? "gap-2 p-3" : "gap-3 p-4"}`}>
      <div className={`flex flex-col ${isMobile ? "gap-2" : "gap-2"}`}>
        <div>
          <label className={`font-medium text-gray-600 ${isMobile ? "text-xs" : "text-xs"}`} htmlFor={`name-${staged.id}`}>
            {t("storage.fields.nameLabel")}
          </label>
          <Input
            id={`name-${staged.id}`}
            value={staged.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            autoComplete="off"
            className={`mt-1 ${isMobile ? "text-sm" : ""}`}
          />
        </div>

        <div>
          <label className={`font-medium text-gray-600 ${isMobile ? "text-xs" : "text-xs"}`} htmlFor={`type-${staged.id}`}>
            {t("storage.fields.typeLabel")}
          </label>
          <Select
            value={staged.type}
            onValueChange={(value) => onUpdate({ type: value as DocumentType })}
          >
            <SelectTrigger id={`type-${staged.id}`} className={`mt-1 ${isMobile ? "text-sm" : ""}`}>
              <SelectValue placeholder={t("storage.fields.typePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`flex items-center justify-between text-gray-500 ${isMobile ? "text-xs" : "text-xs"}`}>
        <span className="truncate pr-2">{staged.file.name}</span>
        <span className="flex-shrink-0">{formatFileSize(staged.file.size)}</span>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size={isMobile ? "sm" : "icon"}
          onClick={onRemove}
          className={`text-gray-500 hover:text-red-600 ${isMobile ? "h-8 px-2" : ""}`}
        >
          <Trash2 className="h-4 w-4" />
          {isMobile && <span className="ml-1 text-xs">{t("common.remove")}</span>}
          {!isMobile && <span className="sr-only">{t("common.remove")}</span>}
        </Button>
      </div>
    </div>
  );
}
