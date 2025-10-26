// nextjs/src/features/interactions/components/detail/InteractionEditDialog.tsx
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ContactSelector from "@interactions/components/ContactSelector";
import StructureSelector from "@interactions/components/StructureSelector";
import InteractionTagsSelector from "@interactions/components/InteractionTagsSelector";
import { INTERACTION_STATUSES, INTERACTION_TYPES } from "@interactions/constants";
import { toIsoStringFromInput, toLocalDateTimeInput } from "@interactions/utils/datetime";
import { useUpdateInteraction } from "@interactions/hooks/useUpdateInteraction";
import type { Interaction, InteractionStatus, InteractionType } from "@interactions/types";
import { extractAmountFromMetadata, formatAmountForInput, parseAmountInput } from "@interactions/utils/amount";

type InteractionEditDialogProps = {
  interaction: Interaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function InteractionEditDialog({ interaction, open, onOpenChange, onSaved }: InteractionEditDialogProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const { updateInteraction, loading, error, setError } = useUpdateInteraction();

  const [subject, setSubject] = useState(interaction.subject);
  const [type, setType] = useState<InteractionType>(interaction.type);
  const [status, setStatus] = useState<InteractionStatus | "">(interaction.status ?? "");
  const [occurredAt, setOccurredAt] = useState<string>(toLocalDateTimeInput(interaction.occurred_at));
  const [tagIds, setTagIds] = useState<string[]>(interaction.tags.map((tag) => tag.id));
  const [contactIds, setContactIds] = useState<string[]>(interaction.contacts.map((contact) => contact.id));
  const [structureIds, setStructureIds] = useState<string[]>(interaction.structures.map((structure) => structure.id));
  const [formError, setFormError] = useState("");
  const [quoteAmount, setQuoteAmount] = useState(() =>
    interaction.type === "quote" ? formatAmountForInput(extractAmountFromMetadata(interaction.metadata)) : ""
  );

  useEffect(() => {
    if (!open) return;
    setSubject(interaction.subject);
    setType(interaction.type);
    setStatus(interaction.status ?? "");
    setOccurredAt(toLocalDateTimeInput(interaction.occurred_at) || "");
    setTagIds(interaction.tags.map((tag) => tag.id));
    setContactIds(interaction.contacts.map((contact) => contact.id));
    setStructureIds(interaction.structures.map((structure) => structure.id));
    setQuoteAmount(
      interaction.type === "quote" ? formatAmountForInput(extractAmountFromMetadata(interaction.metadata)) : ""
    );
    setFormError("");
    setError("");
  }, [interaction, open, setError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setFormError(t("interactionssubjectRequired"));
      return;
    }

    if (type === "quote" && contactIds.length === 0 && structureIds.length === 0) {
      setFormError(t("interactionsquoteAssociationRequired"));
      return;
    }

    const occurredAtIso = toIsoStringFromInput(occurredAt) ?? interaction.occurred_at;

    let metadataPayload: Record<string, unknown> | null | undefined;
    if (type === "quote") {
      const trimmedAmount = quoteAmount.trim();
      if (!trimmedAmount) {
        setFormError(t("interactionsamountRequired"));
        return;
      }
      const parsedAmount = parseAmountInput(trimmedAmount);
      if (parsedAmount === null) {
        setFormError(t("interactionsamountInvalid"));
        return;
      }
      metadataPayload = { amount: parsedAmount };
    } else if (interaction.type === "quote") {
      metadataPayload = null;
    }

    try {
      await updateInteraction(interaction.id, {
        subject: trimmedSubject,
        type,
        status: status === "" ? null : (status as InteractionStatus),
        occurredAt: occurredAtIso,
        tagIds,
        contactIds,
        structureIds,
        metadata: metadataPayload,
      });
      show({ title: t("interactionsupdated"), variant: "success" });
      onSaved();
      onOpenChange(false);
    } catch (updateError) {
      console.error(updateError);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setFormError("");
          setError("");
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="Test">
        <DialogHeader>
          <DialogTitle>{t("interactionsedit.title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-subject">
                {t("common.subject")}
              </label>
              <Input
                id="edit-interaction-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={t("interactionssubjectPlaceholder")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-type">
                  {t("interactionstypeLabel")}
                </label>
                <select
                  id="edit-interaction-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as InteractionType)}
                  className="border rounded-md h-9 w-full px-3 text-sm bg-background"
                >
                  {INTERACTION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`interactionstypes.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-status">
                  {t("interactionsstatusLabel")}
                </label>
                <select
                  id="edit-interaction-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as InteractionStatus | "")}
                  className="border rounded-md h-9 w-full px-3 text-sm bg-background"
                >
                  {INTERACTION_STATUSES.map((value) => (
                    <option key={value ?? "none"} value={value ?? ""}>
                      {value ? t(`interactionsstatus.${value}`) : t("interactionsstatusNone")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {type === "quote" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-quote-amount">
                  {t("interactionsamountLabel")}
                </label>
                <Input
                  id="edit-interaction-quote-amount"
                  value={quoteAmount}
                  onChange={(event) => setQuoteAmount(event.target.value)}
                  placeholder={t("interactionsamountPlaceholder")}
                />
                <p className="text-xs text-gray-500">{t("interactionsamountHelper")}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="edit-interaction-occurred-at">
                {t("interactionsoccurredAtLabel")}
              </label>
              <Input
                id="edit-interaction-occurred-at"
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
          </div>

          <InteractionTagsSelector
            householdId={interaction.household_id}
            value={tagIds}
            onChange={setTagIds}
            inputId="edit-interaction-tags"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t("interactionscontacts.label")}</label>
            <p className="text-xs text-gray-500">{t("interactionscontacts.helper")}</p>
            <ContactSelector householdId={interaction.household_id} value={contactIds} onChange={setContactIds} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t("interactionsstructures.label")}</label>
            <p className="text-xs text-gray-500">{t("interactionsstructures.helper")}</p>
            <StructureSelector householdId={interaction.household_id} value={structureIds} onChange={setStructureIds} />
          </div>

          {(formError || error) && (
            <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
              {formError || error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                setFormError("");
                setError("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
