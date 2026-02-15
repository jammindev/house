// nextjs/src/features/project-groups/components/ProjectGroupCreateForm.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ProjectGroupCreateFormValues = {
  name: string;
  description: string;
  tags: string; // comma-separated
};

const INITIAL_VALUES: ProjectGroupCreateFormValues = {
  name: "",
  description: "",
  tags: "",
};

type ProjectGroupCreateFormProps = {
  onSubmit: (values: ProjectGroupCreateFormValues) => Promise<void>;
  onCancel?: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export default function ProjectGroupCreateForm({ onSubmit, onCancel, t }: ProjectGroupCreateFormProps) {
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectGroupCreateFormValues>({
    defaultValues: INITIAL_VALUES,
  });

  const onSubmitForm = handleSubmit(async (values) => {
    setSubmitError("");
    const hasName = values.name.trim().length > 0;
    if (!hasName) {
      setError("name", { type: "manual", message: t("projectGroups.nameRequired") });
      return;
    }

    try {
      await onSubmit(values);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("projectGroups.createFailed");
      setSubmitError(message);
    }
  });

  const errorMessage = submitError || errors.name?.message;

  return (
    <form onSubmit={onSubmitForm} className="space-y-6">
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">{t("projectGroups.createTitle")}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t("projectGroups.createDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{errorMessage}</div>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-1">
              <label htmlFor="pg-name" className="text-sm font-medium text-foreground">
                {t("projectGroups.name")}
              </label>
              <Input id="pg-name" autoFocus placeholder={t("projectGroups.namePlaceholder")} {...register("name")} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="pg-description" className="text-sm font-medium text-foreground">
                {t("projectGroups.description")}
              </label>
              <Textarea
                id="pg-description"
                placeholder={t("projectGroups.descriptionPlaceholder")}
                rows={4}
                {...register("description")}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="pg-tags" className="text-sm font-medium text-foreground">
                {t("projectGroups.tags")}
              </label>
              <Input id="pg-tags" placeholder={t("projectGroups.tagsPlaceholder")} {...register("tags")} />
            </div>
          </section>
        </CardContent>
        <CardFooter className="flex flex-col justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row">
          {onCancel ? (
            <Button type="button" variant="ghost" className="w-full sm:w-auto" disabled={isSubmitting} onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          ) : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("projectGroups.saveGroup")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
