import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";

const config: StorybookConfig = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-essentials", "@storybook/addon-a11y", "@storybook/addon-themes"],
	framework: {
		name: "@storybook/react-vite",
		options: {}
	},
	docs: {
		autodocs: "tag"
	},
	viteFinal: async (baseConfig) => {
		baseConfig.resolve = baseConfig.resolve ?? {};
		baseConfig.resolve.alias = {
			...(typeof baseConfig.resolve.alias === "object" ? baseConfig.resolve.alias : {}),
			"@": path.resolve(__dirname, "../src")
		};

		return baseConfig;
	}
};

export default config;
