"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectListFilters } from "@projects/types";

interface TextSearchProps {
    filters: ProjectListFilters;
    setFilters: (f: ProjectListFilters) => void;
}

export default function TextSearch({ filters, setFilters }: TextSearchProps) {
    const { t } = useI18n();
    const [value, setValue] = useState<string>(filters.search ?? "");
    const timerRef = useRef<number | null>(null);

    // keep local input in sync when external filters change
    useEffect(() => {
        setValue(filters.search ?? "");
    }, [filters.search]);

    // debounce updates to setFilters
    useEffect(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
        }
        // small debounce
        timerRef.current = window.setTimeout(() => {
            setFilters({ ...filters, search: value || undefined });
            timerRef.current = null;
        }, 300);

        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    function handleClear() {
        setValue("");
        setFilters({ ...filters, search: undefined });
    }

    return (
        <div className="flex items-center gap-2">
            <div className="relative flex items-center w-full">
                <span className="absolute left-2 text-slate-400">
                    <Search size={16} />
                </span>
                <Input
                    className="pl-8 w-full md:w-64"
                    placeholder={t("projects.filters.searchPlaceholder")}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            handleClear();
                        }
                    }}
                />
            </div>
            {value ? (
                <Button size="sm" variant="ghost" onClick={handleClear} aria-label={t("common.clear")}>
                    <X />
                </Button>
            ) : null}
        </div>
    );
}
