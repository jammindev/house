// nextjs/src/components/ui/responsive-overlay.tsx
"use client";

import {
  cloneElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@documents/hooks/useIsMobile";
import { X } from "lucide-react";
import { Z_INDEX_CLASSES } from "@/lib/design-tokens";

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
  minHeight?: string;
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
  minHeight,
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
          onInteractOutside={(event) => {
            const originalTarget = event.detail?.originalEvent?.target;
            if (originalTarget instanceof Element && originalTarget.closest("[data-allow-interact]")) {
              event.preventDefault();
            }
          }}
          aria-describedby={description ? undefined : ""}
          className={cn(
            "rounded-t-3xl bg-background p-2 shadow-2xl max-w-4xl mx-auto flex flex-col justify-between",
            containerClassName,
          )}
          style={{
            minHeight: minHeight,
            maxHeight: "87vh",
          }}
        >
          <div
            className={cn(
              "flex flex-col gap-4 overflow-y-auto p-5 ",
              contentClassName,
            )}
          >
            <div>
              {title ? (
                <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
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
        </DialogContent>
        {open && closeLabel && (
          <DialogClose asChild data-allow-interact>
            <Button
              data-allow-interact
              variant="ghost"
              size="icon"
              className={cn(
                "fixed left-4 top-4 rounded-full border border-border/40 bg-background/80 p-2 opacity-80 shadow-lg backdrop-blur transition-all duration-200 hover:bg-background hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                Z_INDEX_CLASSES.overlay.drawer
              )}
              aria-label={closeLabel}
            >
              <X />
            </Button>
          </DialogClose>
        )}
      </Dialog>
    </>
  );
}
