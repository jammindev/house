import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";
import { cn } from "@/utils/cn";
import styles from "./Tooltip.module.css";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {}

export const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	TooltipContentProps
>(({ className, sideOffset = 6, children, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			className={cn(styles.content, className)}
			sideOffset={sideOffset}
			{...props}
		>
			{children}
			<TooltipPrimitive.Arrow className={styles.arrow} />
		</TooltipPrimitive.Content>
	</TooltipPrimitive.Portal>
));

TooltipContent.displayName = TooltipPrimitive.Content.displayName;
