"use client";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import type { Entry } from "@entries/types";

interface Props {
    entry: Entry;
    fileCount: number;
    t: (key: string, args?: Record<string, any>) => string;
}

export default function EntryItem({ entry, fileCount, t }: Props) {
    return (
        <Link
            href={`/app/entries/${entry.id}`}
            className="border rounded-lg p-4 bg-white flex gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">{new Date(entry.created_at).toLocaleString()}</div>
                    {fileCount > 0 && (
                        <div className="flex items-center gap-1 text-gray-600" title={t("entries.attachments")}>
                            <Paperclip className="w-4 h-4" />
                            <span className="text-xs">{fileCount}</span>
                        </div>
                    )}
                </div>
                <div className="block mt-1 text-gray-900 line-clamp-3 whitespace-pre-wrap">
                    {entry.raw_text}
                </div>
            </div>
        </Link>
    );
}