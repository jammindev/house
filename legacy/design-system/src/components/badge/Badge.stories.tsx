import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
	title: "Components/Badge",
	component: Badge,
	tags: ["autodocs"],
	args: {
		children: "Status"
	},
	parameters: {
		layout: "centered"
	}
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Playground: Story = {};

export const Variants: Story = {
	render: () => (
		<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
			<Badge variant="neutral">Neutral</Badge>
			<Badge variant="accent">Accent</Badge>
			<Badge variant="success">Success</Badge>
			<Badge variant="warning">Warning</Badge>
			<Badge variant="info">Info</Badge>
			<Badge variant="outline">Outline</Badge>
		</div>
	)
};
