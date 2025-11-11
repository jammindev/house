// nextjs/src/components/ui/responsive-overlay.tsx
"use client";

import {
  cloneElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type KeyboardEvent,
  useCallback,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@documents/hooks/useIsMobile";

type ResponsiveOverlayRenderProps = {
  close: () => void;
  open: () => void;
  isOpen: boolean;
  isMobile: boolean;
};

type ResponsiveOverlayProps = {
  trigger: ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;
  children: ReactNode | ((helpers: ResponsiveOverlayRenderProps) => ReactNode);
  title?: ReactNode;
  description?: ReactNode;
  closeLabel?: string | null;
  contentClassName?: string;
  containerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SheetDialog({
  trigger,
  children,
  title,
  description,
  closeLabel = "Close",
  contentClassName,
  containerClassName,
  open: controlledOpen,
  onOpenChange,
}: ResponsiveOverlayProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const helpers = useMemo<ResponsiveOverlayRenderProps>(
    () => ({
      close: () => setOpen(false),
      open: () => setOpen(true),
      isOpen: open,
      isMobile,
    }),
    [open, isMobile, setOpen],
  );

  const content = typeof children === "function" ? children(helpers) : children;


  const triggerWithHandler = cloneElement(trigger, {
    onClick: (event: MouseEvent<HTMLElement>) => {
      trigger.props?.onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(true);
      }
    },
  });

  return (
    <>
      {triggerWithHandler}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          variant="mobileSheet"
          hideDefaultCloseButton
          aria-describedby={description ? undefined : ""}
          className={cn(
            "rounded-t-3xl border-none bg-background p-0 pb-2 shadow-2xl max-w-4xl mx-auto",
            containerClassName,
          )}
        >
          <div
            className={cn(
              "flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-5",
              contentClassName,
            )}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={closeLabel ?? "Close"}
              title={closeLabel ?? "Close"} className="w-full h-6" onClick={() => helpers.close()}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                // Close on Enter or Space (handle various browser key values)
                if (e.key === "Enter" || e.key === " " || e.key === "Spacebar" || e.key === "Space") {
                  e.preventDefault();
                  helpers.close();
                }
              }}>
              <div
                className="mx-auto h-1.5 w-12 rounded-full bg-muted"
              />
            </div>
            <div className="space-y-1">
              {title ? (
                <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
              ) : (
                // DialogContent requires a DialogTitle for accessibility. If no title was
                // provided, render a visually hidden title so screen readers still have
                // an accessible name for the dialog.
                <VisuallyHidden>
                  <DialogTitle>Dialog</DialogTitle>
                </VisuallyHidden>
              )}
              {description && (
                <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
              )}
            </div>
            {content}
          </div>
          {closeLabel && (
            <div className="border-t border-border px-5 pt-3">
              <Button variant="ghost" className="w-full" onClick={helpers.close}>
                {closeLabel}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
