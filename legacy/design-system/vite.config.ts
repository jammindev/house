import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src")
		}
	},
	build: {
		lib: {
			entry: path.resolve(__dirname, "src/index.ts"),
			name: "HouseDesignSystem",
			formats: ["es", "cjs"],
			fileName: (format) => (format === "es" ? "index.js" : "index.cjs")
		},
		rollupOptions: {
			external: ["react", "react-dom", "@radix-ui/react-slot", "@radix-ui/react-tooltip", "clsx"],
			output: {
				globals: {
					react: "React",
					"react-dom": "ReactDOM"
				}
			}
		}
	}
});
