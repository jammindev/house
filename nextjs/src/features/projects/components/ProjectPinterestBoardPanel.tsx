"use client";

import { useState } from "react";
import { ExternalLink, Link2, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import type { ProjectWithMetrics } from "@projects/types";

interface ProjectPinterestBoardPanelProps {
  project: ProjectWithMetrics;
  onUpdate?: () => void;
}

export default function ProjectPinterestBoardPanel({
  project,
  onUpdate,
}: ProjectPinterestBoardPanelProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(project.pinterest_board_url ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePinterestUrl = (inputUrl: string): boolean => {
    if (!inputUrl.trim()) return true; // Empty is valid (will remove the board)
    
    try {
      const urlObj = new URL(inputUrl);
      return urlObj.hostname.includes("pinterest.com") || urlObj.hostname.includes("pin.it");
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    const trimmedUrl = url.trim();
    
    // Validate URL if not empty
    if (trimmedUrl && !validatePinterestUrl(trimmedUrl)) {
      show({
        title: t("projects.pinterest.invalidUrl"),
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSPASassClientAuthenticated();
      const { error } = await supabase
        .from("projects")
        .update({ pinterest_board_url: trimmedUrl || null })
        .eq("id", project.id);

      if (error) {
        throw error;
      }

      const wasEmpty = !project.pinterest_board_url;
      const isEmpty = !trimmedUrl;
      
      let successMessage = t("projects.pinterest.successUpdate");
      if (wasEmpty && !isEmpty) {
        successMessage = t("projects.pinterest.successAdd");
      } else if (!wasEmpty && isEmpty) {
        successMessage = t("projects.pinterest.successRemove");
      }

      show({
        title: successMessage,
        variant: "success",
      });

      setIsEditing(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update Pinterest board:", error);
      show({
        title: t("common.unexpectedError"),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setUrl(project.pinterest_board_url ?? "");
    setIsEditing(false);
  };

  const handleRemove = async () => {
    setUrl("");
    setIsSubmitting(true);

    try {
      const supabase = createSPASassClientAuthenticated();
      const { error } = await supabase
        .from("projects")
        .update({ pinterest_board_url: null })
        .eq("id", project.id);

      if (error) {
        throw error;
      }

      show({
        title: t("projects.pinterest.successRemove"),
        variant: "success",
      });

      setIsEditing(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to remove Pinterest board:", error);
      show({
        title: t("common.unexpectedError"),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Display mode when there's a URL and not editing
  if (project.pinterest_board_url && !isEditing) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Link2 className="h-5 w-5 text-primary-600" />
                  {t("projects.pinterest.title")}
                </h2>
                <p className="text-sm text-slate-500">{t("projects.pinterest.description")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 truncate">
                  <p className="truncate text-sm text-slate-700">{project.pinterest_board_url}</p>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="ml-2 shrink-0"
                >
                  <a
                    href={project.pinterest_board_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    {t("projects.pinterest.viewBoard")}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Pinterest embed iframe */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <iframe
                src={`${project.pinterest_board_url}?embed=true`}
                className="h-[400px] w-full"
                title={t("projects.pinterest.title")}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode or add mode
  if (isEditing) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Link2 className="h-5 w-5 text-primary-600" />
                  {project.pinterest_board_url
                    ? t("projects.pinterest.editButton")
                    : t("projects.pinterest.addButton")}
                </h2>
                <p className="text-sm text-slate-500">{t("projects.pinterest.description")}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor="pinterest-url" className="text-sm font-medium text-slate-900">
                {t("projects.pinterest.urlLabel")}
              </label>
              <Input
                id="pinterest-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("projects.pinterest.urlPlaceholder")}
                disabled={isSubmitting}
              />
              <p className="text-xs text-slate-500">{t("projects.pinterest.urlHelper")}</p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? "..." : t("projects.pinterest.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                {t("projects.pinterest.cancel")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial state: no URL set, show add button
  return null;
}
