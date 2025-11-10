import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Button } from "@/components/button/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

const meta: Meta<typeof Tooltip> = {
	title: "Components/Tooltip",
	component: Tooltip,
	parameters: {
		layout: "centered"
	}
};

export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Playground: Story = {
	render: () => (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="outline">Hover me</Button>
			</TooltipTrigger>
			<TooltipContent>House tooltip powered by Radix.</TooltipContent>
		</Tooltip>
	)
};
