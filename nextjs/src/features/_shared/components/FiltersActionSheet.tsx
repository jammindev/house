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
}

export default function FiltersActionSheet({
  children,
  title,
  description,
  icon: Icon = Filter,
  buttonVariant = "outline",
  buttonSize = "sm",
  ariaLabel,
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
        >
          <Icon />
        </Button>
      )}
    >
      {children}
    </SheetDialog>
  );
}
