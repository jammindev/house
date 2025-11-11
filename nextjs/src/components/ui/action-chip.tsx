// nextjs/src/components/ui/action-chip.tsx
"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { cn } from "@/lib/utils";

export type ActionChipAction = {
  key: string;
  label: string;
  description?: string | null;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export type ActionChipVariant = "default" | "contact" | "structure";

const VARIANT_STYLES: Record<ActionChipVariant, string> = {
  default: "border-border/60 bg-muted/30 text-foreground hover:bg-muted/60 focus-visible:ring-ring",
  contact: "border-indigo-200/60 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus-visible:ring-indigo-500",
  structure: "border-emerald-200/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500",
};

type ActionChipProps = {
  label: string;
  actions: ActionChipAction[];
  helperText?: string;
  closeLabel?: string;
  variant?: ActionChipVariant;
  chipClassName?: string;
};

export function ActionChip({
  label,
  actions,
  helperText = "Choose an action",
  closeLabel = "Close",
  variant = "default",
  chipClassName,
}: ActionChipProps) {
  return (
    <SheetDialog
      trigger={<ChipButton label={label} variant={variant} className={chipClassName} />}
      title={label}
      description={helperText}
      closeLabel={closeLabel}
    >
      {({ close, isMobile }) => (
        <div className={cn("flex flex-col gap-1", isMobile && "gap-1.5")}>
          {actions.map((action) => (
            <ActionButton
              key={action.key}
              action={action}
              fullWidth={isMobile}
              onSelect={close}
            />
          ))}
        </div>
      )}
    </SheetDialog>
  );
}

type ActionButtonProps = {
  action: ActionChipAction;
  onSelect?: () => void;
  fullWidth?: boolean;
};

function ActionButton({ action, onSelect, fullWidth }: ActionButtonProps) {
  const content = (
    <>
      <action.icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col text-left">
        <span className="text-sm font-medium leading-tight text-foreground">{action.label}</span>
        {action.description && (
          <span className="text-xs text-muted-foreground">{action.description}</span>
        )}
      </div>
    </>
  );

  const sharedButtonProps = {
    variant: "ghost" as const,
    size: "sm" as const,
    className: cn(
      "justify-start gap-3",
      fullWidth ? "w-full rounded-xl border px-3 py-2 text-left text-base" : "w-full",
    ),
  };

  if (action.disabled || !action.href) {
    return (
      <Button type="button" {...sharedButtonProps} disabled>
        {content}
      </Button>
    );
  }

  const handleSelect = () => {
    onSelect?.();
  };

  if (action.href.startsWith("/")) {
    return (
      <Button {...sharedButtonProps} asChild>
        <Link href={action.href} onClick={handleSelect}>
          {content}
        </Link>
      </Button>
    );
  }

  const isExternalLink = action.href.startsWith("http");
  return (
    <Button {...sharedButtonProps} asChild>
      <a
        href={action.href}
        target={isExternalLink ? "_blank" : undefined}
        rel={isExternalLink ? "noreferrer" : undefined}
        onClick={handleSelect}
      >
        {content}
      </a>
    </Button>
  );
}

type ChipButtonProps = {
  label: string;
  variant: ActionChipVariant;
  className?: string;
  onClick?: () => void;
};

const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(function ChipButton(
  { label, variant, className, onClick },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <span className="line-clamp-1">{label}</span>
    </button>
  );
});
