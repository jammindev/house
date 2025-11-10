export const paletteOptions = [
	{ id: "house", label: "House (Evergreen)", className: "theme-house" },
	{ id: "blue", label: "Atlantic Blue", className: "theme-blue" },
	{ id: "sass", label: "Rosé", className: "theme-sass" },
	{ id: "sass2", label: "Sage", className: "theme-sass2" },
	{ id: "sass3", label: "Ocean Sunset", className: "theme-sass3" },
	{ id: "purple", label: "Purple Glow", className: "theme-purple" },
	{ id: "green", label: "Garden", className: "theme-green" }
] as const;

export type PaletteId = (typeof paletteOptions)[number]["id"];

export const paletteClassMap: Record<PaletteId, string> = paletteOptions.reduce(
	(acc, palette) => {
		acc[palette.id] = palette.className;
		return acc;
	},
	{} as Record<PaletteId, string>
);

export function isPaletteId(value: unknown): value is PaletteId {
	return typeof value === "string" && paletteOptions.some((palette) => palette.id === value);
}
