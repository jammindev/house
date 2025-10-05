"use client";
import EntryItem from "./EntryItem";
import type { Entry } from "@entries/types";

interface Props {
    entries: Entry[];
    fileCounts: Record<string, number>;
    t: (key: string, args?: Record<string, any>) => string;
}

export default function EntryList({ entries, fileCounts, t }: Props) {
    if (entries.length === 0) {
        return <div className="text-sm text-gray-500">{t("entries.none")}</div>;
    }
    return (
        <ul className="space-y-3">
            {entries.map((e) => (
                <li key={e.id}>
                    <EntryItem entry={e} fileCount={fileCounts[e.id] || 0} t={t} />
                </li>
            ))}
        </ul>
    );
}