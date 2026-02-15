import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Button } from "@/components/button/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from "./Card";

const meta: Meta<typeof Card> = {
	title: "Components/Card",
	component: Card,
	subcomponents: { CardHeader, CardContent, CardFooter, CardTitle, CardDescription },
	parameters: {
		layout: "centered"
	},
	tags: ["autodocs"]
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Playground: Story = {
	render: () => (
		<Card style={{ width: 360 }}>
			<CardHeader>
				<CardTitle>Kitchen refresh</CardTitle>
				<CardDescription>Electrical, painting, and lighting fixtures.</CardDescription>
			</CardHeader>
			<CardContent>
				<ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
					<li>Confirm electrician quote</li>
					<li>Approve fixture list</li>
					<li>Upload cabinet measurements</li>
				</ul>
			</CardContent>
			<CardFooter style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
				<Button variant="ghost">Later</Button>
				<Button>Open project</Button>
			</CardFooter>
		</Card>
	)
};
