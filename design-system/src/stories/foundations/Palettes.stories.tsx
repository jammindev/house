import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { ThemeProvider, paletteOptions } from "@/theme";

const meta: Meta = {
	title: "Foundations/Palettes",
	parameters: {
		layout: "fullscreen"
	},
	tags: ["autodocs"]
};

export default meta;

type Story = StoryObj;

export const Gallery: Story = {
	render: () => (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
				gap: "1rem"
			}}
		>
			{paletteOptions.map((palette) => (
				<ThemeProvider key={palette.id} palette={palette.id}>
					<div
						style={{
							border: "1px solid hsl(var(--border))",
							borderRadius: "var(--radius)",
							overflow: "hidden"
						}}
					>
						<div style={{ padding: "1rem" }}>
							<h3 style={{ margin: 0 }}>{palette.label}</h3>
							<p style={{ margin: "0.25rem 0 0", color: "hsl(var(--muted-foreground))" }}>
								class: <code>{palette.className}</code>
							</p>
						</div>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(3, 1fr)"
							}}
						>
							{["primary", "secondary", "accent"].map((token) => (
								<div
									key={token}
									style={{
										padding: "1rem",
										backgroundColor: `var(--color-${token}-500)`,
										color: "#fff",
										textTransform: "capitalize",
										fontWeight: 600
									}}
								>
									{token}
								</div>
							))}
						</div>
					</div>
				</ThemeProvider>
			))}
		</div>
	)
};
