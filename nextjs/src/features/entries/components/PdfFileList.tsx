"use client";
import { FileText } from "lucide-react";
import type { EntryFile } from "@entries/types";

interface PdfFileListProps {
    files: EntryFile[];
    previews: Record<string, string>;
    t: (key: string) => string;
}

export default function PdfFileList({ files, previews, t }: PdfFileListProps) {
    const fileNameSafe = (path: string) =>
        path.split("/").pop() || t("common.file");

    return (
        <section>
            <h2 className="text-lg font-medium mb-2">{t("entries.pdfFiles") ?? "Documents PDF"}</h2>
            <ul className="space-y-3">
                {files.map((file) => {
                    const url = previews[file.id];
                    const fileName = fileNameSafe(file.storage_path);
                    return (
                        <li
                            key={file.id}
                            className="flex items-center gap-3 border border-gray-200 rounded-md bg-white p-3"
                        >
                            <div className="h-10 w-10 flex items-center justify-center rounded border border-gray-200 bg-gray-50">
                                <FileText className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="truncate text-sm text-gray-800">{fileName}</span>
                                {url && (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        {t("common.open")}
                                    </a>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
