"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import type {
  ProjectFormData,
  UploadedDocument,
  GeneratedPlan,
} from "../../types";
import { Loader2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AIPlanReviewStepProps {
  formData: ProjectFormData;
  documents: UploadedDocument[];
  generatedPlan: GeneratedPlan | null;
  onPlanGenerated: (plan: GeneratedPlan) => void;
  onPlanUpdated: (plan: GeneratedPlan) => void;
  onBack: () => void;
  onCancel: () => void;
  onSuccess: () => void;
}

export function AIPlanReviewStep({
  formData,
  documents,
  generatedPlan,
  onPlanGenerated,
  onPlanUpdated,
  onBack,
  onCancel,
  onSuccess,
}: AIPlanReviewStepProps) {
  const { t } = useI18n();
  const { selectedHouseholdId, user } = useGlobal();
  const { show } = useToast();
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate plan on mount if not already generated
  useEffect(() => {
    if (!generatedPlan && !generating) {
      handleGeneratePlan();
    }
  }, []);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Prepare document context
      const documentContext = documents.map(
        (doc) => `${doc.name} (${doc.type})`
      );

      const response = await fetch("/api/projects/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description,
          plannedBudget: formData.plannedBudget,
          zoneIds: formData.zoneIds,
          tags: formData.tags,
          startDate: formData.startDate,
          dueDate: formData.dueDate,
          documentContext,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate plan";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage} (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const plan: GeneratedPlan = await response.json();
      onPlanGenerated(plan);
      show({ title: t("projects.wizard.planGenerated"), variant: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      show({ title: t("projects.wizard.planError", { error: message }), variant: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateProject = async () => {
    if (!generatedPlan || !selectedHouseholdId || !user) return;

    setCreating(true);
    setError(null);

    try {
      const supabase = await createSPASassClientAuthenticated();
      const client = supabase.getSupabaseClient();

      // 1. Create the project
      const { data: project, error: projectError } = await client
        .from("projects")
        .insert({
          household_id: selectedHouseholdId,
          title: generatedPlan.title,
          description: generatedPlan.refinedDescription,
          priority: formData.priority,
          start_date: formData.startDate || null,
          due_date: formData.dueDate || null,
          tags: formData.tags,
          planned_budget: formData.plannedBudget || 0,
          status: formData.status,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Link zones to project via project_zones
      if (formData.zoneIds.length > 0) {
        const { error: zonesError } = await client
          .from("project_zones")
          .insert(
            formData.zoneIds.map((zoneId) => ({
              project_id: project.id,
              zone_id: zoneId,
            }))
          );

        if (zonesError) console.error("Error linking zones:", zonesError);
      }

      // 3. Create interactions for todos
      const todoPromises = generatedPlan.todos.map(async (todo) => {
        // Insert interaction
        const { data: interaction, error: interactionError } = await client
          .from("interactions")
          .insert({
            household_id: selectedHouseholdId,
            subject: todo.subject,
            content: todo.content || "",
            type: "todo",
            status: "pending",
            project_id: project.id,
            occurred_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (interactionError) {
          console.error("Error creating todo:", interactionError);
          return null;
        }

        // Link zones
        if (interaction && todo.zoneIds.length > 0) {
          const { error: zoneError } = await client
            .from("interaction_zones")
            .insert(
              todo.zoneIds.map((zoneId) => ({
                interaction_id: interaction.id,
                zone_id: zoneId,
              }))
            );

          if (zoneError) {
            console.error("Error linking todo zones:", zoneError);
          }
        }

        return interaction;
      });

      // 4. Create interactions for notes
      const notePromises = generatedPlan.notes.map(async (note) => {
        // Insert interaction
        const { data: interaction, error: interactionError } = await client
          .from("interactions")
          .insert({
            household_id: selectedHouseholdId,
            subject: note.subject,
            content: note.content || "",
            type: "note",
            project_id: project.id,
            occurred_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (interactionError) {
          console.error("Error creating note:", interactionError);
          return null;
        }

        // Link zones
        if (interaction && note.zoneIds.length > 0) {
          const { error: zoneError } = await client
            .from("interaction_zones")
            .insert(
              note.zoneIds.map((zoneId) => ({
                interaction_id: interaction.id,
                zone_id: zoneId,
              }))
            );

          if (zoneError) {
            console.error("Error linking note zones:", zoneError);
          }
        }

        return interaction;
      });

      await Promise.all([...todoPromises, ...notePromises]);

      // 5. Link documents to project
      if (documents.length > 0) {
        // First create document records
        const { data: docRecords, error: docError } = await client
          .from("documents")
          .insert(
            documents.map((doc) => ({
              household_id: selectedHouseholdId,
              file_path: doc.uploadedUrl!,
              name: doc.name,
              mime_type: doc.type,
              type: "document",
              notes: doc.notes || "",
            }))
          )
          .select();

        if (docError) {
          console.error("Error creating documents:", docError);
        } else if (docRecords) {
          // Then link them via project_documents
          const { error: linkError } = await client
            .from("project_documents")
            .insert(
              docRecords.map((doc: any) => ({
                project_id: project.id,
                document_id: doc.id,
                role: "supporting",
              }))
            );

          if (linkError) {
            console.error("Error linking documents:", linkError);
          }
        }
      }

      show({
        title: t("projects.wizard.creationSuccess", {
          taskCount: generatedPlan.todos.length,
          noteCount: generatedPlan.notes.length,
        }),
        variant: "success"
      });

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      show({ title: t("projects.wizard.creationError", { error: message }), variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium">{t("projects.wizard.generating")}</p>
        <p className="text-sm text-muted-foreground">
          Analyzing your project context...
        </p>
      </div>
    );
  }

  if (error && !generatedPlan) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            {t("projects.wizard.back")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t("projects.wizard.cancel")}
            </Button>
            <Button onClick={handleGeneratePlan}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("projects.wizard.regenerate")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!generatedPlan) return null;

  return (
    <div className="space-y-6">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          {t("projects.wizard.editBeforeCreate")}
        </AlertDescription>
      </Alert>

      {/* Generated Title */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("projects.wizard.generatedTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <h2 className="text-2xl font-semibold">{generatedPlan.title}</h2>
        </CardContent>
      </Card>

      {/* Refined Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("projects.wizard.refinedDescription")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            {generatedPlan.refinedDescription}
          </div>
        </CardContent>
      </Card>

      {/* Suggested Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            {t("projects.wizard.suggestedTasks", {
              count: generatedPlan.todos.length,
            })}
            <Badge variant="secondary">{generatedPlan.todos.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {generatedPlan.todos.length > 0 ? (
            <div className="space-y-3">
              {generatedPlan.todos.map((todo, idx) => (
                <div key={idx} className="border-l-2 border-primary pl-3">
                  <h4 className="font-medium text-sm">{todo.subject}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {todo.content}
                  </p>
                  {todo.priority && (
                    <Badge variant="outline" className="mt-2">
                      Priority: {todo.priority}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("projects.wizard.noTasks")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Suggested Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            {t("projects.wizard.suggestedNotes", {
              count: generatedPlan.notes.length,
            })}
            <Badge variant="secondary">{generatedPlan.notes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {generatedPlan.notes.length > 0 ? (
            <div className="space-y-3">
              {generatedPlan.notes.map((note, idx) => (
                <div key={idx} className="border-l-2 border-muted pl-3">
                  <h4 className="font-medium text-sm">{note.subject}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("projects.wizard.noNotes")}
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={creating}>
          {t("projects.wizard.back")}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGeneratePlan}
            disabled={creating || generating}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("projects.wizard.regenerate")}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={creating}
          >
            {t("projects.wizard.cancel")}
          </Button>
          <Button onClick={handleCreateProject} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {creating
              ? t("projects.wizard.creating")
              : t("projects.wizard.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
