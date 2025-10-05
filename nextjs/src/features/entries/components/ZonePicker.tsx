"use client";

import React, { useCallback, useMemo } from "react";
import type { ZoneOption } from "@entries/types";
import { normalizeZoneSelection } from "@entries/lib/normalizeZoneSelection";

type ZonePickerProps = {
  zones: ZoneOption[];
  value: string[];                        // ✅ multi
  onChange: (next: string[]) => void;     // ✅ multi
};

export default function ZonePicker({ zones, value, onChange }: ZonePickerProps) {
  const zoneMap = useMemo(() => {
    const map = new Map<string, ZoneOption>();
    zones.forEach(z => map.set(z.id, z));
    return map;
  }, [zones]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, ZoneOption[]>();
    zones.forEach(zone => {
      if (zone.parent_id) {
        const list = map.get(zone.parent_id) || [];
        list.push(zone);
        map.set(zone.parent_id, list);
      }
    });
    map.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [zones]);

  const roots = useMemo(
    () =>
      zones
        .filter(z => !z.parent_id || !zoneMap.has(z.parent_id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [zones, zoneMap]
  );

  const getDescendants = useCallback(
    (zoneId: string) => {
      const result: string[] = [];
      const stack = [...(childrenMap.get(zoneId) || [])];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        result.push(current.id);
        const kids = childrenMap.get(current.id);
        if (kids?.length) stack.push(...kids);
      }
      return result;
    },
    [childrenMap]
  );

  const toggleZone = useCallback(
    (zoneId: string) => {
      const isSelected = value.includes(zoneId);
      const descendants = getDescendants(zoneId);

      // Retire la zone + ses descendants
      let next = value.filter(id => id !== zoneId && !descendants.includes(id));

      // Ajoute si on sélectionne
      if (!isSelected) next = [...next, zoneId];

      onChange(normalizeZoneSelection(next, zones));
    },
    [getDescendants, onChange, value, zones]
  );

  const renderBranch = useCallback(
    (zone: ZoneOption, depth = 0): React.ReactNode => {
      const isSelected = value.includes(zone.id);
      const children = childrenMap.get(zone.id) || [];

      const indicatorClass = isSelected
        ? "border-primary-500 bg-primary-500 text-white"
        : "border-gray-300 text-transparent group-hover:text-gray-400 group-hover:border-primary-300";

      const baseClass = isSelected
        ? "border-primary-200 bg-primary-50 text-primary-900 shadow-sm"
        : depth === 0
          ? "border-gray-200 bg-white text-gray-800 hover:border-primary-200 hover:bg-primary-50/40"
          : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-200 hover:bg-primary-50/30";

      return (
        <div
          key={zone.id}
          className={
            depth === 0
              ? "rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
              : "space-y-2 border-l border-gray-100 pl-4 ml-2"
          }
        >
          <button
            type="button"
            onClick={() => toggleZone(zone.id)}
            aria-pressed={isSelected}
            data-zone-id={zone.id}
            className={`group flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${baseClass}`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold transition ${indicatorClass}`}
              >
                ✓
              </span>
              <span className="flex items-center gap-2">
                {depth > 0 ? <span className="text-gray-400">↳</span> : null}
                <span className={depth === 0 ? "font-medium text-gray-900" : "text-gray-800"}>
                  {zone.name}
                </span>
              </span>
            </span>
          </button>

          {children.length > 0 && (
            <div className="mt-2 space-y-2">
              {children.map(child => renderBranch(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [childrenMap, toggleZone, value]
  );

  const list = roots.length > 0 ? roots : [...zones].sort((a, b) => a.name.localeCompare(b.name));

  return <div className="space-y-3">{list.map(root => renderBranch(root))}</div>;
}
