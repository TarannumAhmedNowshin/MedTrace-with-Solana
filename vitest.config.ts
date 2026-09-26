import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@anchor": path.resolve(__dirname, "anchor"), "@": path.resolve(__dirname, "src") } },
});
