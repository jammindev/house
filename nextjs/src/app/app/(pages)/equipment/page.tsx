// nextjs/src/app/app/(pages)/equipment/page.tsx
"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import EquipmentList from "@equipment/components/EquipmentList";
import { useEquipmentList } from "@equipment/hooks/useEquipmentList";
import { EQUIPMENT_STATUSES } from "@equipment/constants";
import type { EquipmentStatus } from "@equipment/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { useZones } from "@zones/hooks/useZones";

export default function EquipmentPage() {
  const { t } = useI18n();
  const { items, filters, setFilters, loading, error } = useEquipmentList();
  const { zones } = useZones();

  const actions = useMemo(
    () => [
      {
        icon: Plus,
        href: "/app/equipment/new",
        variant: "default" as const,
      },
    ],
    []
  );

  const handleStatusChange = (value: string) => {
    if (value === "all") {
      setFilters((prev) => ({ ...prev, statuses: [] }));
    } else {
      setFilters((prev) => ({ ...prev, statuses: [value as EquipmentStatus] }));
    }
  };

  const toolbar = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Input
        placeholder={t("equipment.filters.search")}
        value={filters.search ?? ""}
        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
      />
      <Select value={filters.statuses?.[0] ?? "all"} onValueChange={handleStatusChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("equipment.filters.status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("equipment.filters.anyStatus")}</SelectItem>
          {EQUIPMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {t(`equipment.status.${status}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.zoneId ?? "all"}
        onValueChange={(value) =>
          setFilters((prev) => ({ ...prev, zoneId: value === "all" ? null : value }))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder={t("equipment.filters.zone")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("equipment.filters.anyZone")}</SelectItem>
          {zones.map((zone) => (
            <SelectItem key={zone.id} value={zone.id}>
              {zone.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const emptyState = (
    <EmptyState
      title={t("equipment.emptyTitle")}
      description={t("equipment.emptyDescription")}
      action={
        <Button asChild>
          <LinkWithOverlay href="/app/equipment/new">{t("equipment.actions.create")}</LinkWithOverlay>
        </Button>
      }
    />
  );

  return (
    <ListPageLayout
      title={t("equipment.title")}
      subtitle={t("equipment.subtitle")}
      hideBackButton
      actions={actions}
      toolbar={toolbar}
      loading={loading}
      error={error || null}
      errorTitle={t("equipment.loadFailed")}
      isEmpty={!loading && items.length === 0}
      emptyState={emptyState}
    >
      <EquipmentList equipment={items} t={t} />
    </ListPageLayout>
  );
}
