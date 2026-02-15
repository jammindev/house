import { Slot } from "@radix-ui/react-slot";
import React from "react";
import { cn } from "@/utils/cn";
import { isPaletteId, paletteClassMap, type PaletteId, paletteOptions } from "./palettes";

export type ThemeMode = "light" | "dark";

export interface ThemeProviderProps {
	children: React.ReactNode;
	/** Which palette (set of `--color-*` tokens) to apply. */
	palette?: PaletteId;
	/** Toggle between light and dark semantic tokens. */
	mode?: ThemeMode;
	/** Render the provider without wrapping divs by inheriting the child element. */
	asChild?: boolean;
	className?: string;
}

function resolvePalette(value?: unknown): PaletteId {
	if (isPaletteId(value)) {
		return value;
	}

	return paletteOptions[0].id;
}

export const ThemeProvider = React.forwardRef<HTMLDivElement, ThemeProviderProps>(
	({ children, palette = "house", mode = "light", asChild = false, className }, ref) => {
		const Component = asChild ? Slot : "div";
		const resolvedPalette = resolvePalette(palette);

		return (
			<Component
				ref={asChild ? undefined : ref}
				className={cn(
					"house-theme",
					paletteClassMap[resolvedPalette],
					mode === "dark" && "dark",
					className
				)}
				data-mode={mode}
				data-palette={resolvedPalette}
			>
				{children}
			</Component>
		);
	}
);

ThemeProvider.displayName = "ThemeProvider";
