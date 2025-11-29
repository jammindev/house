"use client";

import { useState } from "react";
import { ChevronDown, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectAIThread } from "../types";

interface ProjectAIThreadListProps {
  threads: ProjectAIThread[];
  activeThread: ProjectAIThread | null;
  onSelectThread: (thread: ProjectAIThread) => void;
  onDeleteThread: (threadId: string) => void;
  isLoading: boolean;
}

export function ProjectAIThreadList({
  threads,
  activeThread,
  onSelectThread,
  onDeleteThread,
  isLoading,
}: ProjectAIThreadListProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const formatThreadDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm(t("projects.aiChat.deleteConfirm"))) {
      onDeleteThread(threadId);
    }
  };

  if (threads.length === 0) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-2 justify-between w-full text-left"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MessageSquare className="h-3 w-3 shrink-0" />
            <span className="truncate text-xs">
              {activeThread?.title || t("projects.aiChat.selectThread")}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {t("projects.aiChat.conversations", { count: threads.length })}
        </div>
        <DropdownMenuSeparator />
        {threads.map((thread) => (
          <DropdownMenuItem
            key={thread.id}
            onSelect={() => {
              onSelectThread(thread);
              setIsOpen(false);
            }}
            className="p-0"
          >
            <div className="flex items-start justify-between gap-2 w-full p-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {activeThread?.id === thread.id && (
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">
                    {thread.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatThreadDate(thread.updated_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDeleteThread(thread.id, e)}
                className="h-auto p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                <span className="sr-only">
                  {t("projects.aiChat.deleteThread", { title: thread.title })}
                </span>
              </Button>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}