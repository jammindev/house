"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useStructures } from "@structures/hooks/useStructures";
import type { Structure } from "@structures/types";

type StructureSelectorProps = {
  householdId: string;
  value: string[];
  onChange: (next: string[]) => void;
};

function formatStructureName(structure: Structure) {
  const name = structure.name?.trim() ?? "";
  if (!name) return structure.id;
  if (structure.type) {
    return `${name} (${structure.type})`;
  }
  return name;
}

export default function StructureSelector({ householdId, value, onChange }: StructureSelectorProps) {
  const { t } = useI18n();
  const { structures, loading, error, setError, createStructure } = useStructures();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");

  const selectedStructures = useMemo(
    () => structures.filter((structure) => value.includes(structure.id)),
    [structures, value]
  );

  const filteredStructures = useMemo(() => {
    if (!search.trim()) return structures;
    const term = search.trim().toLowerCase();
    return structures.filter((structure) => {
      const label = formatStructureName(structure).toLowerCase();
      const description = (structure.description ?? "").toLowerCase();
      return label.includes(term) || description.includes(term);
    });
  }, [structures, search]);

  const toggleStructure = (structureId: string) => {
    const exists = value.includes(structureId);
    if (exists) {
      onChange(value.filter((id) => id !== structureId));
    } else {
      onChange([...value, structureId]);
    }
  };

  const handleRemove = (structureId: string) => {
    onChange(value.filter((id) => id !== structureId));
  };

  const resetCreateForm = () => {
    setName("");
    setType("");
    setCreateError("");
  };

  const handleCreateStructure = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreateError("");
    try {
      setCreating(true);
      const structure = await createStructure({
        householdId,
        name,
        type,
      });
      if (structure && !value.includes(structure.id)) {
        onChange([...value, structure.id]);
      }
      setShowCreate(false);
      resetCreateForm();
    } catch (createErr) {
      console.error(createErr);
      const message = createErr instanceof Error ? createErr.message : t("structures.createFailed");
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {selectedStructures.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedStructures.map((structure) => (
            <li key={structure.id}>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {formatStructureName(structure)}
                <button
                  type="button"
                  onClick={() => handleRemove(structure.id)}
                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 hover:bg-emerald-200"
                  aria-label={t("interactionsstructures.removeStructure", { name: formatStructureName(structure) })}
                >
                  {t("common.remove")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">{t("interactionsstructures.noneSelected")}</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          {t("interactionsstructures.openPicker")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowCreate(true)}>
          {t("interactionsstructures.createInline")}
        </Button>
      </div>

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) {
            setSearch("");
            setError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("interactionsstructures.dialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("interactionsstructures.searchPlaceholder")}
            />

            {loading ? (
              <p className="text-sm text-gray-500">{t("common.loading")}</p>
            ) : filteredStructures.length === 0 ? (
              <p className="text-sm text-gray-500">{t("interactionsstructures.noResults")}</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredStructures.map((structure) => {
                  const isSelected = value.includes(structure.id);
                  return (
                    <button
                      key={structure.id}
                      type="button"
                      onClick={() => toggleStructure(structure.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        isSelected ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{structure.name}</p>
                          {structure.type ? (
                            <p className="text-xs text-gray-500 truncate">{structure.type}</p>
                          ) : structure.description ? (
                            <p className="text-xs text-gray-500 truncate">{structure.description}</p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-gray-300 bg-white text-gray-400"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected ? "✓" : "+"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
              {t("common.close")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                setShowCreate(true);
              }}
            >
              {t("interactionsstructures.quickCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("interactionsstructures.createTitle")}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateStructure}>
            {createError && <p className="text-xs text-red-600">{createError}</p>}

            <div className="space-y-2">
              <label htmlFor="inline-structure-name" className="text-sm font-medium text-gray-700">
                {t("interactionsstructures.name")}
              </label>
              <Input
                id="inline-structure-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("interactionsstructures.namePlaceholder")}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="inline-structure-type" className="text-sm font-medium text-gray-700">
                {t("interactionsstructures.type")}
              </label>
              <Input
                id="inline-structure-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                placeholder={t("interactionsstructures.typePlaceholder")}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? t("common.saving") : t("interactionsstructures.saveStructure")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
