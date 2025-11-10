import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip/Tooltip";
import { cn } from "@/utils/cn";
import styles from "./CountBadge.module.css";

export type CountBadgeDisplay = "inline" | "tooltip";
export type CountBadgeTone = "neutral" | "primary" | "success" | "warning";

export interface CountBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "onClick"> {
	icon?: React.ReactNode;
	count?: number | null;
	label?: string;
	display?: CountBadgeDisplay;
	onClick?: React.MouseEventHandler<HTMLElement>;
	tone?: CountBadgeTone;
	disabled?: boolean;
}

const toneClassMap: Record<CountBadgeTone, string> = {
	neutral: styles.toneNeutral,
	primary: styles.tonePrimary,
	success: styles.toneSuccess,
	warning: styles.toneWarning
};

export function CountBadge({
	icon,
	count,
	label,
	display = "tooltip",
	tone = "neutral",
	className,
	disabled,
	onClick,
	...props
}: CountBadgeProps) {
	const Component: "button" | "span" = onClick ? "button" : "span";

	const content = (
		<>
			{icon ? (
				<span aria-hidden className={styles.icon}>
					{icon}
				</span>
			) : null}
			{typeof count === "number" ? <span className={styles.count}>{count}</span> : null}
			{display === "inline" && label ? <span className={styles.label}>{label}</span> : null}
		</>
	);

	const element = (
		<Component
			type={onClick ? "button" : undefined}
			onClick={onClick}
			aria-label={display === "tooltip" ? label : undefined}
			className={cn(styles.badge, toneClassMap[tone], onClick && styles.clickable, className)}
			disabled={onClick ? disabled : undefined}
			{...(props as React.HTMLAttributes<HTMLElement>)}
		>
			{content}
		</Component>
	);

	if (display === "tooltip" && label) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{element}</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		);
	}

	return element;
}
