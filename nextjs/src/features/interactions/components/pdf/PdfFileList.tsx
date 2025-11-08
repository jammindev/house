// nextjs/src/features/entries/components/pdf/PdfFileList.tsx
"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import PdfFileItem from "./PdfFileItem";
import type { Document } from "@interactions/types";
import type { FilePreview } from "@interactions/hooks/useSignedFilePreviews";

interface PdfFileListProps {
  files: Document[];
  previews: Record<string, FilePreview>;
  onDeleted?: () => void;
}

export default function PdfFileList({ files, previews, onDeleted }: PdfFileListProps) {
  const { t } = useI18n();

  return (
    <section className="space-y-4">
      <ul role="list" className="space-y-3">
        {files.map((file) => {
          const preview = previews[file.id];
          return (
            <PdfFileItem
              key={file.id}
              file={file}
              viewUrl={preview?.view}
              downloadUrl={preview?.download}
              onDeleted={onDeleted}
            />
          );
        })}
      </ul>
    </section>
  );
}
