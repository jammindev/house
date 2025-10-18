"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContactHeaderProps {
  title: string;
  description?: string;
  addLabel: string;
  onAdd: () => void;
  disabled?: boolean;
}

export default function ContactHeader({ title, description, addLabel, onAdd, disabled }: ContactHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={addLabel}
        onClick={onAdd}
        disabled={disabled}
        className="shrink-0"
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
