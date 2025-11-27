// nextjs/src/features/_shared/components/FiltersActionSheet.tsx
"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Filter } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";

interface FiltersActionSheetProps {
  children: ReactNode;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  ariaLabel?: string;
  isActive?: boolean;
}

export default function FiltersActionSheet({
  children,
  title,
  description,
  icon: Icon = Filter,
  buttonVariant = "outline",
  buttonSize = "sm",
  ariaLabel,
  isActive = false,
}: FiltersActionSheetProps) {
  return (
    <SheetDialog
      title={title}
      description={description}
      trigger={(
        <Button
          variant={buttonVariant}
          size={buttonSize}
          aria-label={ariaLabel ?? title ?? "Filters"}
          className="relative"
        >
          <Icon />
          {isActive ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </Button>
      )}
    >
      {children}
    </SheetDialog>
  );
}
