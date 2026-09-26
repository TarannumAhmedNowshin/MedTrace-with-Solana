// Cross-checks the program source against the frontend's contract. Runs offline, no deps.
//   node scripts/check-contract.mjs [path/to/idl.json]
// Fails (exit 1) if error codes, Pack field order, memcmp offsets, instruction/account names
// or status variants drift between lib.rs, the IDL the app uses, and the app's code.
import { readFileSync } from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const lib = readFileSync(path.join(here, "../anchor/programs/medtrace/src/lib.rs"), "utf8");
const idlPath = process.argv[2] ?? path.join(here, "../anchor/idl/medtrace.json");
const idl = JSON.parse(readFileSync(idlPath, "utf8"));
const appErrors = readFileSync(path.join(here, "../src/lib/medtrace/errors.ts"), "utf8");
const appPda = readFileSync(path.join(here, "../src/lib/medtrace/pda.ts"), "utf8");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
};
const block = (re) => (lib.match(re) ?? [, ""])[1];

// 1. Error codes: same names, same order (→ same 6000+ numbers)
const rsErrors = [...block(/pub enum MedError \{([\s\S]*?)\n\}/).matchAll(/^\s*(\w+),/gm)].map((m) => m[1]);
const idlErrors = (idl.errors ?? []).map((e) => e.name);
check("error codes match IDL (names + order)", JSON.stringify(rsErrors) === JSON.stringify(idlErrors), `${rsErrors} vs ${idlErrors}`);
check("app errors.ts knows every program error", rsErrors.every((e) => appErrors.includes(`"${e}"`)), rsErrors.filter((e) => !appErrors.includes(`"${e}"`)).join(","));

// 2. Pack layout: field order + memcmp offsets
const fields = [...block(/pub struct Pack \{([\s\S]*?)\n\}/).matchAll(/pub (\w+):\s*([\w<>]+)/g)].map((m) => [m[1], m[2]]);
const idlPack = idl.types.find((t) => t.name === "Pack").type.fields.map((f) => f.name);
check("Pack field order matches IDL", JSON.stringify(fields.map(([n]) => n)) === JSON.stringify(idlPack), `${fields.map(([n]) => n)} vs ${idlPack}`);
const size = { Pubkey: 32, PackStatus: 1, i64: 8, u8: 1 };
let off = 8;
const offsets = {};
for (const [n, t] of fields) {
  if (!(t in size)) break; // strings last → offsets stop being fixed
  offsets[n] = off;
  off += size[t];
}
const appOffsets = Object.fromEntries([...appPda.matchAll(/(\w+):\s*(\d+)/g)].filter(([, k]) => ["manufacturer", "holder", "status"].includes(k)).map(([, k, v]) => [k, +v]));
check("memcmp offsets match app pda.ts", ["manufacturer", "holder", "status"].every((k) => offsets[k] === appOffsets[k]), `${JSON.stringify(offsets)} vs ${JSON.stringify(appOffsets)}`);
check("strings come after all fixed fields", fields.findIndex(([, t]) => t === "String") === Object.keys(offsets).length);

// 3. Status variants
const rsStatus = [...block(/pub enum PackStatus \{([\s\S]*?)\n\}/).matchAll(/^\s*(\w+),/gm)].map((m) => m[1]);
const idlStatus = idl.types.find((t) => t.name === "PackStatus").type.variants.map((v) => v.name);
check("PackStatus variants match IDL", JSON.stringify(rsStatus) === JSON.stringify(idlStatus), `${rsStatus} vs ${idlStatus}`);

// 4. Instructions + account names the app passes to accountsPartial()
const rsIx = [...block(/pub mod medtrace \{([\s\S]*?)\n\}/).matchAll(/pub fn (\w+)\(ctx: Context<(\w+)>/g)].map((m) => [m[1], m[2]]);
for (const [ix, ctxName] of rsIx) {
  const rsAccts = [...block(new RegExp(`pub struct ${ctxName}<'info> \\{([\\s\\S]*?)\\n\\}`)).matchAll(/pub (\w+):/g)].map((m) => m[1]);
  const idlIx = idl.instructions.find((i) => i.name === ix);
  check(`instruction ${ix} exists in IDL`, !!idlIx);
  if (idlIx) check(`  ${ix} accounts match`, JSON.stringify(rsAccts) === JSON.stringify(idlIx.accounts.map((a) => a.name)), `${rsAccts} vs ${idlIx.accounts.map((a) => a.name)}`);
}

// 5. PDA seed
check('PDA seed prefix is "pack" in program and app', lib.includes('PACK_SEED: &[u8] = b"pack"') && appPda.includes('enc.encode("pack")'));

console.log(failures ? `\n${failures} contract check(s) FAILED` : "\nContract OK: program ⇄ IDL ⇄ app are consistent");
process.exit(failures ? 1 : 0);
