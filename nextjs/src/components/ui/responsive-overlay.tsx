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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  trigger: ReactElement;
  children: ReactNode | ((helpers: ResponsiveOverlayRenderProps) => ReactNode);
  title?: ReactNode;
  description?: ReactNode;
  closeLabel?: string | null;
  popoverContentClassName?: string;
  mobileContentClassName?: string;
  mobileContainerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ResponsiveOverlay({
  trigger,
  children,
  title,
  description,
  closeLabel = "Close",
  popoverContentClassName,
  mobileContentClassName,
  mobileContainerClassName,
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

  if (isMobile) {
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
              "rounded-t-3xl border-none bg-background p-0 pb-2 shadow-2xl",
              mobileContainerClassName,
            )}
          >
            <div className={cn("flex flex-col gap-4 p-5", mobileContentClassName)}>
              <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />
              {(title || description) && (
                <div className="space-y-1">
                  {title && <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>}
                  {description && (
                    <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
                  )}
                </div>
              )}
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className={cn("w-64 space-y-3 p-3", popoverContentClassName)}>
        {(title || description) && (
          <div className="space-y-1">
            {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        )}
        {content}
      </PopoverContent>
    </Popover>
  );
}
