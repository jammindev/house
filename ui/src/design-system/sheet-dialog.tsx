import {
  cloneElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react"

import { Button } from "@/design-system/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/design-system/dialog"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/hooks/useIsMobile"
import { X } from "lucide-react"

// Accessible visually-hidden wrapper (replaces @radix-ui/react-visually-hidden)
function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {children}
    </span>
  )
}

type SheetDialogRenderProps = {
  close: () => void
  open: () => void
  isOpen: boolean
  isMobile: boolean
}

type SheetDialogProps = {
  trigger: ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>
  children: ReactNode | ((helpers: SheetDialogRenderProps) => ReactNode)
  title?: ReactNode
  description?: ReactNode
  closeLabel?: string | null
  contentClassName?: string
  containerClassName?: string
  minHeight?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

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
}: SheetDialogProps) {
  const isMobile = useIsMobile()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next)
      }
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const helpers = useMemo<SheetDialogRenderProps>(
    () => ({
      close: () => setOpen(false),
      open: () => setOpen(true),
      isOpen: open,
      isMobile,
    }),
    [open, isMobile, setOpen],
  )

  const content = typeof children === "function" ? children(helpers) : children

  const triggerWithHandler = cloneElement(trigger, {
    onClick: (event: MouseEvent<HTMLElement>) => {
      trigger.props?.onClick?.(event)
      if (!event.defaultPrevented) {
        setOpen(true)
      }
    },
  })

  return (
    <>
      {triggerWithHandler}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          variant="mobileSheet"
          hideDefaultCloseButton
          onInteractOutside={(event) => {
            const originalTarget = (event as CustomEvent).detail?.originalEvent?.target
            if (originalTarget instanceof Element && originalTarget.closest("[data-allow-interact]")) {
              event.preventDefault()
            }
          }}
          aria-describedby={description ? undefined : ""}
          className={cn(
            "rounded-t-3xl bg-background p-2 shadow-2xl max-w-2xl mx-auto lg:mx-0 lg:ml-[22rem] xl:ml-[30rem] flex flex-col justify-between",
            containerClassName,
          )}
          style={{
            minHeight: minHeight,
            maxHeight: "87vh",
          }}
        >
          <div className={cn("flex flex-col gap-4 overflow-y-auto p-5", contentClassName)}>
            <div>
              {title ? (
                <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
              ) : (
                <VisuallyHidden>
                  <DialogTitle>Dialog</DialogTitle>
                </VisuallyHidden>
              )}
              {description && (
                <DialogDescription className="text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
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
              className="fixed left-4 lg:left-[30rem] top-4 z-[70] rounded-full border border-border/40 bg-background/80 p-2 opacity-80 shadow-lg backdrop-blur transition-all duration-200 hover:bg-background hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={closeLabel}
            >
              <X />
            </Button>
          </DialogClose>
        )}
      </Dialog>
    </>
  )
}
