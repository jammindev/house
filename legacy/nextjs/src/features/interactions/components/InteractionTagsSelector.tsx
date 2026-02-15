"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { InteractionTag } from "@interactions/types";

type InteractionTagsSelectorProps = {
  householdId: string | null;
  value: string[];
  onChange: (next: string[]) => void;
  inputId?: string;
};

const sortTags = (list: InteractionTag[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

const isPostgrestError = (error: unknown): error is PostgrestError =>
  typeof error === "object" && error !== null && "code" in error;

export default function InteractionTagsSelector({
  householdId,
  value,
  onChange,
  inputId = "interaction-tags",
}: InteractionTagsSelectorProps) {
  const { t } = useI18n();
  const { show } = useToast();

  const [availableTags, setAvailableTags] = useState<InteractionTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const selectedTags = useMemo(
    () =>
      value
        .map((id) => availableTags.find((tag) => tag.id === id) || null)
        .filter((tag): tag is InteractionTag => Boolean(tag)),
    [availableTags, value]
  );

  useEffect(() => {
    let active = true;
    if (!householdId) {
      setAvailableTags([]);
      setTagsLoading(false);
      return;
    }

    const load = async () => {
      setTagsLoading(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error } = await client
          .from("tags")
          .select("id, name, household_id, type, created_at, created_by")
          .eq("household_id", householdId)
          .eq("type", "interaction")
          .order("name", { ascending: true });
        if (error) throw error;
        if (!active) return;
        const rows = (data ?? []) as InteractionTag[];
        setAvailableTags(sortTags(rows));
      } catch (err: unknown) {
        console.error(err);
        if (!active) return;
        setAvailableTags([]);
      } finally {
        if (active) setTagsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [householdId]);

  useEffect(() => {
    const filtered = value.filter((id) => availableTags.some((tag) => tag.id === id));
    if (filtered.length !== value.length || filtered.some((id, index) => id !== value[index])) {
      onChange(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTags]);

  const toggleTag = useCallback(
    (tagId: string) => {
      onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId]);
    },
    [onChange, value]
  );

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      onChange(value.filter((id) => id !== tagId));
    },
    [onChange, value]
  );

  const handleCreateTag = useCallback(async () => {
    const trimmed = tagInputValue.trim();
    if (!trimmed || !householdId) return;
    const match = availableTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      onChange(value.includes(match.id) ? value : [...value, match.id]);
      setTagInputValue("");
      return;
    }

    setCreatingTag(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error } = await client
        .from("tags")
        .insert({ household_id: householdId, type: "interaction", name: trimmed })
        .select("id, name, household_id, type, created_at, created_by")
        .single();
      if (error) {
        if (isPostgrestError(error) && error.code === "23505") {
          const dup = availableTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
          if (dup) {
            onChange(value.includes(dup.id) ? value : [...value, dup.id]);
            setTagInputValue("");
            return;
          }
        }
        throw error;
      }

      const newTag = (data as InteractionTag) ?? null;
      if (newTag) {
        setAvailableTags((prev) => sortTags([...prev, newTag]));
        onChange([...value, newTag.id]);
      }
      setTagInputValue("");
    } catch (err: unknown) {
      console.error(err);
      const description = err instanceof Error ? err.message : t("interactionstagsCreateFailed");
      show({ title: t("interactionstagsCreateFailed"), description, variant: "error" });
    } finally {
      setCreatingTag(false);
    }
  }, [availableTags, householdId, onChange, show, t, tagInputValue, value]);

  const handleTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!creatingTag) {
        handleCreateTag();
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700" htmlFor={inputId}>
        {t("interactionstagsLabel")}
      </label>
      <p className="text-xs text-gray-500">{t("interactionstagsHelper")}</p>

      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
            >
              #{tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="rounded-full p-0.5 leading-none text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800"
                aria-label={t("interactionstagsRemove", { name: tag.name })}
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">{t("interactionstagsNone")}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          value={tagInputValue}
          onChange={(event) => setTagInputValue(event.target.value)}
          onKeyDown={handleTagInputKeyDown}
          placeholder={t("interactionstagsCreatePlaceholder")}
          disabled={!householdId}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleCreateTag}
          disabled={creatingTag || !tagInputValue.trim() || !householdId}
        >
          {creatingTag ? t("common.saving") : t("interactionstagsAdd")}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("interactionstagsExisting")}</p>
        {tagsLoading ? (
          <div className="text-xs text-gray-500">{t("interactionstagsLoading")}</div>
        ) : availableTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const selected = value.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${selected
                    ? "border-indigo-200 bg-indigo-100 text-indigo-700"
                    : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  aria-pressed={selected}
                >
                  #{tag.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-gray-500">{t("interactionstagsNone")}</div>
        )}
      </div>
    </div>
  );
}
