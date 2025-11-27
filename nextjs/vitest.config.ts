import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@dashboard": path.resolve(__dirname, "./src/features/dashboard"),
      "@zones": path.resolve(__dirname, "./src/features/zones"),
      "@interactions": path.resolve(__dirname, "./src/features/interactions"),
      "@contacts": path.resolve(__dirname, "./src/features/contacts"),
      "@documents": path.resolve(__dirname, "./src/features/documents"),
      "@structures": path.resolve(__dirname, "./src/features/structures"),
      "@projects": path.resolve(__dirname, "./src/features/projects"),
      "@shared": path.resolve(__dirname, "./src/features/_shared"),
    },
  },
});
