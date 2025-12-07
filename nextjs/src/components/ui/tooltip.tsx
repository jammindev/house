"use client"

import * as React from "react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Z_INDEX_CLASSES } from "@/lib/design-tokens"

import { cn } from "@/lib/utils"

// Reuse the existing Popover component as a Tooltip implementation.
// TooltipProvider is not required for the Popover; export a Fragment for API compatibility.
const Tooltip = Popover
const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>
const TooltipTrigger = PopoverTrigger

const TooltipContent = React.forwardRef<
    React.ElementRef<typeof PopoverContent>,
    React.ComponentPropsWithoutRef<typeof PopoverContent>
>(({ className, side = "top", align = "center", sideOffset = 6, ...props }, ref) => (
    <PopoverContent
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        side={side}
        className={cn(
            `${Z_INDEX_CLASSES.interactive.tooltip} max-w-xs rounded-md border bg-popover px-2 py-1.5 text-sm text-popover-foreground shadow-md`,
            className
        )}
        {...props}
    />
))
TooltipContent.displayName = PopoverContent.displayName

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent }
