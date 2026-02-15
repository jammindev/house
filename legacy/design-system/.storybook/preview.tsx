import type { Preview } from "@storybook/react";
import React from "react";
import { TooltipProvider } from "@/components/tooltip/Tooltip";
import { ThemeProvider, type PaletteId, paletteOptions, type ThemeMode } from "@/theme";
import "../src/styles/global.css";

const paletteToolbarItems = paletteOptions.map((palette) => ({
	value: palette.id,
	title: palette.label
}));

const preview: Preview = {
	globalTypes: {
		palette: {
			name: "Palette",
			description: "House multi-tenant color palettes",
			defaultValue: "house",
			toolbar: {
				icon: "paintbrush",
				items: paletteToolbarItems
			}
		},
		colorMode: {
			name: "Mode",
			description: "Light/Dark semantic tokens",
			defaultValue: "light",
			toolbar: {
				icon: "circlehollow",
				items: [
					{ value: "light", title: "Light" },
					{ value: "dark", title: "Dark" }
				]
			}
		}
	},
	parameters: {
		backgrounds: {
			default: "surface",
			values: [
				{ name: "surface", value: "#f8fafc" },
				{ name: "canvas", value: "#ffffff" },
				{ name: "dark", value: "#0f172a" }
			]
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/
			}
		},
		options: {
			storySort: {
				order: ["Foundations", "Components"]
			}
		}
	},
	decorators: [
		(Story, context) => (
			<ThemeProvider
				palette={context.globals.palette as PaletteId}
				mode={context.globals.colorMode as ThemeMode}
			>
				<TooltipProvider delayDuration={200}>
					<Story />
				</TooltipProvider>
			</ThemeProvider>
		)
	]
};

export default preview;
