import { build } from "/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/lib/main.js";
import { readdirSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const tests = readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.ts"));
await build({
  entryPoints: tests.map((t) => path.join(root, "tests", t)),
  outdir: path.join(root, "preview/dist/tests"), bundle: true, platform: "node", format: "esm",
  outExtension: { ".js": ".mjs" }, logLevel: "error",
  alias: { "@anchor": path.join(root, "anchor"), "@": path.join(root, "src"), vitest: path.join(root, "preview/shims/vitest.ts") },
});
console.log("built", tests.length, "test files");
