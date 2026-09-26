import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import path from "node:path";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
await p.goto("file://" + path.resolve(import.meta.dirname, "dist/index.html") + "#/manufacturer"); await p.waitForTimeout(1200);
console.log(await p.evaluate(() => { const g = document.querySelector(".grid-2"); const cs = getComputedStyle(g); return { cols: cs.gridTemplateColumns, gap: cs.gap, kids: [...g.children].map(c => { const r = c.getBoundingClientRect(); return [c.className, r.left, r.width, c.scrollWidth]; }) }; }));
await b.close();
