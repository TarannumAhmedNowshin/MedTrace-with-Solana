// Builds a single self-contained HTML preview of the frontend (no npm access needed).
import { build } from "/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/lib/main.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const shim = (f) => path.join(root, "preview/shims", f);
const out = path.join(root, "preview/dist");
mkdirSync(out, { recursive: true });

const redirects = {
  "next/link": shim("next-link.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next/dynamic": shim("next-dynamic.tsx"),
  "@tanstack/react-query": shim("react-query.tsx"),
  "@solana/wallet-adapter-react": shim("wallet-react.tsx"),
  "@solana/wallet-adapter-react-ui": shim("wallet-react-ui.tsx"),
  "@solana/wallet-adapter-react-ui/styles.css": shim("empty.ts"),
  "@solana/web3.js": shim("web3.ts"),
  "qrcode.react": shim("qrcode-react.tsx"),
  buffer: shim("empty.ts"),
};

const previewPlugin = {
  name: "preview-shims",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (redirects[args.path]) return { path: redirects[args.path] };
      if (args.path.startsWith("@/")) {
        const p = args.path.slice(2);
        if (p === "lib/medtrace/http") return { path: shim("http.ts") };
        return undefined; // handled by alias below
      }
      if (/^\.\/http$/.test(args.path) && args.importer.includes("lib/medtrace")) return { path: shim("http.ts") };
      if (/^\.\/onchain$/.test(args.path) && args.importer.includes("lib/medtrace")) return { path: shim("onchain.ts") };
      return undefined;
    });
  },
};

const env = {
  "process.env.NODE_ENV": '"production"',
  "process.env.NEXT_PUBLIC_MEDTRACE_MODE": '"mock"',
  "process.env.NEXT_PUBLIC_DEMO_WALLETS": '""',
  "process.env.NEXT_PUBLIC_API_BASE": '""',
  "process.env.NEXT_PUBLIC_CLUSTER": '"devnet"',
  "process.env.NEXT_PUBLIC_RPC_URL": '"https://api.devnet.solana.com"',
  "process.env.NEXT_PUBLIC_APP_URL": '"https://medtrace.vercel.app"',
  "process.env.NEXT_PUBLIC_PROGRAM_ID": '""',
  "process.env.RPC_URL": '""',
};

const res = await build({
  entryPoints: [path.join(root, "preview/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  write: false,
  outdir: out,
  define: env,
  alias: { "@anchor": path.join(root, "anchor"), "@": path.join(root, "src") },
  nodePaths: ["/home/claude/.npm-global/lib/node_modules"],
  plugins: [previewPlugin],
  logLevel: "warning",
});

const js = res.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const previewCss = `
.preview-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 16px;background:#111827;color:#e5e7eb;font-size:13px}
.preview-bar button{background:#374151;color:#fff;border:0;border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer;min-height:32px}
.preview-bar .spacer{flex:1}
.qr-print-btn{display:none}
:root{--font-sans:"Inter"}`;

// Body only: the Artifact publisher wraps it in the page skeleton.
const body = `<title>MedTrace Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${css}\n${previewCss}</style>
<div id="root"></div>
<script>${js.replace(/<\/script/g, "<\\/script")}</script>`;
writeFileSync(path.join(out, "medtrace-preview.html"), body);

// Full document for local screenshots.
writeFileSync(path.join(out, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${body.replace('<div id="root">', '</head><body><div id="root">')}</body></html>`);
console.log("preview built:", (body.length / 1024).toFixed(0), "KB");
