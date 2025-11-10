import { Slot } from "@radix-ui/react-slot";
import React from "react";
import { cn } from "@/utils/cn";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	asChild?: boolean;
}

const variantClassNames: Record<ButtonVariant, string> = {
	primary: styles.primary,
	secondary: styles.secondary,
	outline: styles.outline,
	ghost: styles.ghost,
	destructive: styles.destructive
};

const sizeClassNames: Record<ButtonSize, string> = {
	sm: styles.sizeSm,
	md: styles.sizeMd,
	lg: styles.sizeLg,
	icon: styles.sizeIcon
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
		const Component = asChild ? Slot : "button";

		return (
			<Component
				className={cn(styles.button, variantClassNames[variant], sizeClassNames[size], className)}
				ref={asChild ? undefined : ref}
				{...props}
			/>
		);
	}
);

Button.displayName = "Button";
