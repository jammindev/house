// nextjs/src/features/_shared/components/FiltersActionSheet.tsx
"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Filter } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import ActiveIndicator from "@shared/components/ActiveIndicator";

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
  buttonSize = "icon",
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
          {isActive ? <ActiveIndicator /> : null}
        </Button>
      )}
    >
      {children}
    </SheetDialog>
  );
}
