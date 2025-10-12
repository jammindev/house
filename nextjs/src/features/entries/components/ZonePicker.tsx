// nextjs/src/features/entries/components/ZonePicker.tsx

"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ZoneOption } from "../types";
import { normalizeZoneSelection } from "../lib/normalizeZoneSelection";

type ZonePickerProps = {
  zones: ZoneOption[];
  value: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
};

export function ZonePicker({ zones, value, onChange }: ZonePickerProps) {
  // Track which parent zones are expanded. Children are collapsed by default.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const zoneMap = useMemo(() => {
    const map = new Map<string, ZoneOption>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, ZoneOption[]>();
    zones.forEach((zone) => {
      if (zone.parent_id && zoneMap.has(zone.parent_id)) {
        const list = map.get(zone.parent_id) || [];
        list.push(zone);
        map.set(zone.parent_id, list);
      }
    });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [zones, zoneMap]);

  const roots = useMemo(() => {
    return zones
      .filter((zone) => !zone.parent_id || !zoneMap.has(zone.parent_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [zones, zoneMap]);

  const getDescendants = useCallback(
    (zoneId: string) => {
      const result: string[] = [];
      const stack = [...(childrenMap.get(zoneId) || [])];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        result.push(current.id);
        const kids = childrenMap.get(current.id);
        if (kids?.length) {
          stack.push(...kids);
        }
      }
      return result;
    },
    [childrenMap]
  );

  const toggleExpand = useCallback((zoneId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  }, []);

  const toggleZone = useCallback(
    (zoneId: string) => {
      const isSelected = value.includes(zoneId);
      const descendants = getDescendants(zoneId);
      let next = value.filter((id) => id !== zoneId && !descendants.includes(id));
      if (!isSelected) {
        next = [...next, zoneId];
      }
      onChange(normalizeZoneSelection(next, zones));
    },
    [getDescendants, onChange, value, zones]
  );

  const renderBranch = useCallback(
    (
      zone: { id: string; name: string; parent_id?: string | null },
      depth = 0
    ): React.ReactNode => {
      const isSelected = value.includes(zone.id);
      const children = childrenMap.get(zone.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expanded.has(zone.id);
      const descendantIds = getDescendants(zone.id);
      const selectedDescendantIds = descendantIds.filter((id) => value.includes(id));
      const selectedDescendantsCount = selectedDescendantIds.length;
      const selectedDescendantNames = selectedDescendantIds
        .map((id) => zoneMap.get(id)?.name || "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const wrapperClass =
        depth === 0
          ? "rounded-lg bg-white p-2 shadow-sm"
          : "space-y-1 border-l border-gray-100/60 pl-3";
      const offsetClass = depth > 0 ? "ml-2" : "";

      return (
        <div key={zone.id} className={`${wrapperClass} ${offsetClass}`}>
          <ZoneToggle
            zone={zone}
            selected={isSelected}
            onToggle={() => toggleZone(zone.id)}
            depth={depth}
            hasChildren={hasChildren}
            expanded={isExpanded}
            onToggleExpand={hasChildren ? () => toggleExpand(zone.id) : undefined}
            selectedDescendantsCount={selectedDescendantsCount}
            selectedDescendantNames={selectedDescendantNames}
          />
          {hasChildren && isExpanded ? (
            <div className="mt-1 space-y-1">
              {children.map((child) => renderBranch(child, depth + 1))}
            </div>
          ) : null}
        </div>
      );
    },
    [childrenMap, expanded, toggleExpand, toggleZone, value]
  );

  const list = roots.length > 0 ? roots : [...zones].sort((a, b) => a.name.localeCompare(b.name));

  return <div className="space-y-1">{list.map((root) => renderBranch(root))}</div>;
}

type ZoneToggleProps = {
  zone: { id: string; name: string };
  selected: boolean;
  onToggle: () => void;
  depth: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  selectedDescendantsCount?: number;
  selectedDescendantNames?: string[];
};

function ZoneToggle({
  zone,
  selected,
  onToggle,
  depth,
  hasChildren,
  expanded,
  onToggleExpand,
  selectedDescendantsCount = 0,
  selectedDescendantNames = [],
}: ZoneToggleProps) {
  // Highlight a collapsed parent if any descendant is selected
  const highlighted = !!(hasChildren && !expanded && selectedDescendantsCount > 0);

  const indicatorClass = selected
    ? "border-primary-500 bg-primary-500 text-white"
    : "border-gray-300 bg-white text-transparent";

  const baseClass = selected || highlighted
    ? "bg-primary-50 text-primary-900 ring-1 ring-primary-200"
    : depth === 0
      ? "bg-white text-gray-800"
      : "bg-gray-50 text-gray-700";

  return (
    <div className={`group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors hover:bg-gray-50 ${baseClass}`}>
      <div className="flex items-center gap-3">
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={onToggleExpand}
            className="flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          data-zone-id={zone.id}
          className="flex items-center gap-2"
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold transition ${indicatorClass}`}
          >
            ✓
          </span>
          <span className="flex items-center gap-2">
            {depth > 0 ? <span className="text-gray-400">↳</span> : null}
            <span className={depth === 0 ? "font-medium text-gray-900" : "text-gray-800"}>
              {zone.name}
            </span>
          </span>
        </button>
      </div>
      {hasChildren && !expanded && selectedDescendantsCount > 0 ? (
        <div className="ml-2 max-w-[200px] flex-1 text-right">
          <span
            title={selectedDescendantNames.join(", ")}
            className="inline-block truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] leading-4 text-gray-700"
          >
            {(() => {
              const limit = 3;
              const names = selectedDescendantNames.slice(0, limit);
              const more = selectedDescendantNames.length - names.length;
              return more > 0 ? `${names.join(", ")}… (+${more})` : names.join(", ");
            })()}
          </span>
        </div>
      ) : null}
    </div>
  );
}
