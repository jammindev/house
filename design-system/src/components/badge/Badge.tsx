import React from "react";
import { cn } from "@/utils/cn";
import styles from "./Badge.module.css";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "info" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
}

const variantClassMap: Record<BadgeVariant, string> = {
	neutral: styles.neutral,
	accent: styles.accent,
	success: styles.success,
	warning: styles.warning,
	info: styles.info,
	outline: styles.outline
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
	({ className, variant = "neutral", ...props }, ref) => (
		<span
			ref={ref}
			className={cn(styles.badge, variantClassMap[variant], className)}
			{...props}
		/>
	)
);

Badge.displayName = "Badge";
