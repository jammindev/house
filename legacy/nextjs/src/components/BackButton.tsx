// nextjs/src/components/BackButton.tsx
'use client';

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

const HISTORY_KEY = "appPageLayout:history";

function readHistory(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read back history", error);
    return [];
  }
}

function writeHistory(history: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to persist back history", error);
  }
}

export function pushToBackHistory(pathname: string) {
  if (typeof window === "undefined" || !pathname) return;

  const history = readHistory();
  const lastEntry = history[history.length - 1];

  if (lastEntry === pathname) return;

  const nextHistory = [...history, pathname].filter(Boolean).slice(-50);
  writeHistory(nextHistory);
}

export default function BackButton() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = useCallback(() => {
    const history = readHistory();
    const trimmedHistory = history.filter((entry) => !!entry);

    if (trimmedHistory.length === 0) {
      router.push("/app/dashboard");
      return;
    }

    // Remove current page
    if (trimmedHistory[trimmedHistory.length - 1] === pathname) {
      trimmedHistory.pop();
    }

    const isFormPath = (path: string) => /\/(edit|new)(\/|$)/.test(path);

    let target = "/app/dashboard";
    while (trimmedHistory.length > 0) {
      const candidate = trimmedHistory.pop()!;
      if (candidate === pathname) continue;
      if (isFormPath(candidate)) continue;
      target = candidate;
      break;
    }

    writeHistory(trimmedHistory);
    router.push(target);
  }, [pathname, router]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleBack}
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="sr-only">{t("common.back")}</span>
    </Button>
  );
}
