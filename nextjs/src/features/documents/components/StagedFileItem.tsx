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

type StagedFileItemProps = {
  staged: StagedFile;
  typeOptions: Array<{ value: DocumentType; label: string }>;
  onUpdate: (changes: Partial<Pick<StagedFile, "name" | "type">>) => void;
  onRemove: () => void;
};

export function StagedFileItem({ staged, typeOptions, onUpdate, onRemove }: StagedFileItemProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600" htmlFor={`name-${staged.id}`}>
            {t("storage.fields.nameLabel")}
          </label>
          <Input
            id={`name-${staged.id}`}
            value={staged.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            autoComplete="off"
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600" htmlFor={`type-${staged.id}`}>
            {t("storage.fields.typeLabel")}
          </label>
          <Select
            value={staged.type}
            onValueChange={(value) => onUpdate({ type: value as DocumentType })}
          >
            <SelectTrigger id={`type-${staged.id}`} className="mt-1">
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

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{staged.file.name}</span>
        <span>{formatFileSize(staged.file.size)}</span>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-gray-500 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t("common.remove")}</span>
        </Button>
      </div>
    </div>
  );
}
