import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
	title: "Components/Button",
	component: Button,
	tags: ["autodocs"],
	args: {
		children: "Action",
		variant: "primary",
		size: "md"
	},
	parameters: {
		layout: "centered"
	}
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Playground: Story = {};

export const Variants: Story = {
	render: () => (
		<div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
			<Button variant="primary">Primary</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="destructive">Destructive</Button>
		</div>
	)
};

export const Sizes: Story = {
	render: () => (
		<div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
			<Button size="sm">Small</Button>
			<Button size="md">Medium</Button>
			<Button size="lg">Large</Button>
			<Button size="icon" aria-label="Icon button">
				<span aria-hidden>🏠</span>
			</Button>
		</div>
	)
};
