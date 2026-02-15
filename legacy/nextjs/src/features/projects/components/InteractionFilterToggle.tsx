// nextjs/src/features/projects/components/InteractionFilterToggle.tsx
"use client";

import { useState } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { INTERACTION_FILTERS, DEFAULT_PROJECT_FILTERS } from "@projects/lib/interactionFilters";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface InteractionFilterToggleProps {
    activeFilters: string[];
    onFiltersChange: (filters: string[]) => void;
    className?: string;
}

export default function InteractionFilterToggle({
    activeFilters,
    onFiltersChange,
    className = ""
}: InteractionFilterToggleProps) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);

    const handleFilterToggle = (filterKey: string) => {
        if (activeFilters.includes(filterKey)) {
            // Remove filter
            onFiltersChange(activeFilters.filter(key => key !== filterKey));
        } else {
            // Add filter
            onFiltersChange([...activeFilters, filterKey]);
        }
    };

    const resetToDefault = () => {
        onFiltersChange(DEFAULT_PROJECT_FILTERS);
    };

    const clearAllFilters = () => {
        onFiltersChange([]);
    };

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
                <Filter className="h-4 w-4" />
                {t("projects.timeline.filters")} ({activeFilters.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-slate-900">
                            {t("projects.timeline.filterTitle")}
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={resetToDefault}
                                className="text-xs text-primary-600 hover:text-primary-700"
                            >
                                {t("projects.timeline.defaultFilters")}
                            </button>
                            <button
                                onClick={clearAllFilters}
                                className="text-xs text-slate-500 hover:text-slate-700"
                            >
                                {t("projects.timeline.clearAll")}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {Object.entries(INTERACTION_FILTERS).map(([key, filter]) => (
                            <label key={key} className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={activeFilters.includes(key)}
                                    onChange={() => handleFilterToggle(key)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">
                                        {filter.name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {filter.description}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}