import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { CountBadge } from "./CountBadge";

const meta: Meta<typeof CountBadge> = {
	title: "Components/CountBadge",
	component: CountBadge,
	tags: ["autodocs"],
	args: {
		count: 4,
		label: "Documents",
		display: "tooltip",
		tone: "neutral"
	}
};

export default meta;

type Story = StoryObj<typeof CountBadge>;

export const Playground: Story = {};

export const Inline: Story = {
	args: {
		display: "inline"
	}
};

export const Tones: Story = {
	render: () => (
		<div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
			<CountBadge label="Neutral" tone="neutral" count={12} display="inline" />
			<CountBadge label="Primary" tone="primary" count={6} display="inline" />
			<CountBadge label="Success" tone="success" count={3} display="inline" />
			<CountBadge label="Warning" tone="warning" count={1} display="inline" />
		</div>
	)
};
