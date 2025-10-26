import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@zones": path.resolve(__dirname, "./src/features/zones"),
      "@interactions": path.resolve(__dirname, "./src/features/interactions"),
      "@contacts": path.resolve(__dirname, "./src/features/contacts"),
      "@documents": path.resolve(__dirname, "./src/features/documents"),
      "@structures": path.resolve(__dirname, "./src/features/structures"),
      "@projects": path.resolve(__dirname, "./src/features/projects"),
    },
  },
});
