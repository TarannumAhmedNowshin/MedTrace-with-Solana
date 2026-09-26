import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import path from "node:path";
const root = path.resolve(import.meta.dirname);
const url = "file://" + path.join(root, "dist/index.html");
const browser = await chromium.launch();
const errors = [];
async function page(vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return p;
}
const shot = async (p, hash, name, wait = 1500, full = true) => {
  await p.goto(url + "#" + hash); await p.waitForTimeout(wait);
  await p.screenshot({ path: path.join(root, "shots", name + ".png"), fullPage: full });
};
const d = await page({ width: 1280, height: 860 });
await shot(d, "/", "01-home");
await shot(d, "/manufacturer", "02-manufacturer");
// mint a pack
await d.click("text=Register pack"); await d.waitForTimeout(1500);
await d.screenshot({ path: path.join(root, "shots", "03-manufacturer-minted.png"), fullPage: true });
const minted = await d.inputValue("#serial").catch(() => "?");
// transfer as manufacturer -> distributor
const serial = (await d.textContent(".pack-serial"))?.trim();
console.log("minted", serial, "next suggested", minted);
await shot(d, "/distributor?serial=" + serial, "04-distributor-not-holder");
await d.selectOption(".actorbar select", { index: 0 }); await d.waitForTimeout(1200);
await d.click("text=Transfer " + serial); await d.waitForTimeout(1500);
await d.selectOption(".actorbar select", { index: 1 }); await d.waitForTimeout(1200);
await d.click("text=Transfer " + serial); await d.waitForTimeout(1500);
await d.screenshot({ path: path.join(root, "shots", "05-distributor-transferred.png"), fullPage: true });
await shot(d, "/pharmacy?serial=" + serial, "06-pharmacy-before");
await d.selectOption(".actorbar select", { index: 2 }); await d.waitForTimeout(1200);
await d.click("text=Dispense " + serial); await d.waitForTimeout(1800);
await d.screenshot({ path: path.join(root, "shots", "07-pharmacy-dispensed.png"), fullPage: true });
await d.click("text=Try to dispense again"); await d.waitForTimeout(1500);
await d.screenshot({ path: path.join(root, "shots", "08-pharmacy-double-dispense.png"), fullPage: true });
await shot(d, "/regulator", "09-regulator");
await shot(d, "/qr", "10-qr-sheet");
const m = await page({ width: 390, height: 844 });
for (const [s, n] of [[serial, "11-verify-genuine-new"], ["SQ-000103", "12-verify-clone"], ["SQ-999999", "13-verify-unknown"], ["SQ-000104?pharmacy=PharmDemo11111111111111111111111111111111111", "14-verify-other-pharmacy"]]) {
  await shot(m, "/verify/" + s, n, 1500);
}
await shot(m, "/verify", "15-verify-index", 800);
await shot(d, "/status", "17-status", 1200);
await shot(m, "/pharmacy", "16-pharmacy-mobile", 1500);
console.log("errors:", errors.length ? errors : "none");
await browser.close();
