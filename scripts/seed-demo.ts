/**
 * Seeds devnet with the exact demo scenario the app and pitch expect.
 * Idempotent: re-running advances each pack to its target state and skips what's done.
 *
 *   npm install
 *   export RPC_URL=https://api.devnet.solana.com          # or your Helius devnet URL
 *   export MFR_SECRET=...  DIST_SECRET=...  PHARM_SECRET=...  OTHER_PHARM_SECRET=...
 *        # each: base58 secret key (Phantom → Export Private Key) or a JSON byte array
 *   npm run seed [-- --idl anchor/idl/medtrace.json]
 *
 * ⏱  Run it ≥ 10 minutes before the demo: SQ-000103 must be "old" so it reads as ALREADY_DISPENSED.
 * 🔐 Secrets come from env only. Never commit them.
 */
import { AnchorProvider, BN, Program, Wallet, utils, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Target = "Manufactured" | "InTransit" | "AtPharmacy" | "Dispensed";
const ORDER: Target[] = ["Manufactured", "InTransit", "AtPharmacy", "Dispensed"];

// ─── config ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const idlPath = args.includes("--idl") ? args[args.indexOf("--idl") + 1] : path.resolve(__dirname, "../anchor/idl/medtrace.json");
const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const CLUSTER = process.env.CLUSTER ?? "devnet";

function loadKey(name: string): Keypair {
  const raw = process.env[name];
  if (!raw) throw new Error(`Missing env ${name}`);
  const bytes = raw.trim().startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : utils.bytes.bs58.decode(raw.trim());
  return Keypair.fromSecretKey(bytes);
}

const MFR = loadKey("MFR_SECRET");
const DIST = loadKey("DIST_SECRET");
const PHARM = loadKey("PHARM_SECRET");
const OTHER = loadKey("OTHER_PHARM_SECRET");

/** Demo scenario: mirrors the app's mock seed so screens look the same on real data. */
const SCENARIO: { serial: string; target: Target; pharmacy?: Keypair; note: string }[] = [
  { serial: "SQ-000101", target: "AtPharmacy", note: "GENUINE: ready at pharmacy" },
  { serial: "SQ-000103", target: "Dispensed", note: "the CLONE: dispensed earlier" },
  { serial: "SQ-000104", target: "AtPharmacy", pharmacy: OTHER, note: "OTHER_PHARMACY with ?pharmacy=<main pharmacy>" },
  { serial: "SQ-000105", target: "InTransit", note: "in supply chain" },
  { serial: "SQ-000106", target: "Manufactured", note: "fresh mint" },
  // Spares for the LIVE demo (dispense on stage → scan → GENUINE):
  { serial: "SQ-000110", target: "AtPharmacy", note: "live-demo spare" },
  { serial: "SQ-000111", target: "AtPharmacy", note: "live-demo spare" },
  { serial: "SQ-000112", target: "AtPharmacy", note: "live-demo spare" },
];

// ─── program client ──────────────────────────────────────────────────────
const connection = new Connection(RPC, "confirmed");
const idl = JSON.parse(readFileSync(idlPath, "utf8")) as Idl & { address?: string };
if (!idl.address || idl.address === "11111111111111111111111111111111") {
  throw new Error(`IDL at ${idlPath} has no real program address. Export the IDL from Playground after deploying.`);
}
const programFor = (kp: Keypair) =>
  new Program(idl as Idl, new AnchorProvider(connection, new Wallet(kp), { commitment: "confirmed" }));
const program = programFor(MFR);
const methodsAs = (kp: Keypair) => programFor(kp).methods as any;

const packPda = (serial: string) =>
  PublicKey.findProgramAddressSync([Buffer.from("pack"), Buffer.from(serial)], program.programId)[0];
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;

async function currentStage(serial: string): Promise<Target | null> {
  const acc = await (program.account as any).pack.fetchNullable(packPda(serial));
  if (!acc) return null;
  const k = Object.keys(acc.status)[0].toLowerCase();
  return ORDER.find((s) => s.toLowerCase() === k) ?? null;
}

async function step(label: string, send: () => Promise<string>) {
  const sig = await send();
  console.log(`   ✓ ${label.padEnd(26)} ${explorer(sig)}`);
}

async function advance(serial: string, target: Target, pharmacy: Keypair) {
  let stage = await currentStage(serial);
  const expiry = new BN(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600);
  console.log(`\n▶ ${serial} → ${target}${stage ? ` (currently ${stage})` : ""}`);

  if (!stage) {
    await step("mint_pack", () =>
      methodsAs(MFR).mintPack(serial, "B-2026-09", expiry).accountsPartial({ pack: packPda(serial), manufacturer: MFR.publicKey }).rpc(),
    );
    stage = "Manufactured";
  }
  const want = ORDER.indexOf(target);
  if (ORDER.indexOf(stage) > want) {
    console.log(`   ! already past ${target} (${stage}); leaving as is`);
    return;
  }
  if (stage === "Manufactured" && want >= 1) {
    await step("transfer → distributor", () =>
      methodsAs(MFR).transferCustody(DIST.publicKey).accountsPartial({ pack: packPda(serial), holder: MFR.publicKey }).rpc(),
    );
    stage = "InTransit";
  }
  if (stage === "InTransit" && want >= 2) {
    await step("transfer → pharmacy", () =>
      methodsAs(DIST).transferCustody(pharmacy.publicKey).accountsPartial({ pack: packPda(serial), holder: DIST.publicKey }).rpc(),
    );
    stage = "AtPharmacy";
  }
  if (stage === "AtPharmacy" && want >= 3) {
    await step("dispense", () =>
      methodsAs(pharmacy).dispense().accountsPartial({ pack: packPda(serial), holder: pharmacy.publicKey }).rpc(),
    );
  }
}

async function main() {
  console.log(`MedTrace seed · ${CLUSTER} · program ${program.programId.toBase58()}`);
  for (const [name, kp] of Object.entries({ MFR, DIST, PHARM, OTHER })) {
    const sol = (await connection.getBalance(kp.publicKey)) / 1e9;
    console.log(`  ${name.padEnd(6)} ${kp.publicKey.toBase58()}  ${sol.toFixed(3)} SOL${sol < 0.05 ? "  ⚠ fund me: https://faucet.solana.com" : ""}`);
  }

  for (const s of SCENARIO) await advance(s.serial, s.target, s.pharmacy ?? PHARM);

  // Public keys for app/src/lib/medtrace/config.ts → DEMO_WALLETS
  const out = path.resolve(__dirname, "../demo-wallets.json");
  writeFileSync(
    out,
    JSON.stringify(
      {
        programId: program.programId.toBase58(),
        manufacturer: MFR.publicKey.toBase58(),
        distributor: DIST.publicKey.toBase58(),
        pharmacy: PHARM.publicKey.toBase58(),
        otherPharmacy: OTHER.publicKey.toBase58(),
      },
      null,
      2,
    ),
  );
  const env = JSON.stringify({
    manufacturer: MFR.publicKey.toBase58(),
    distributor: DIST.publicKey.toBase58(),
    pharmacy: PHARM.publicKey.toBase58(),
    otherPharmacy: OTHER.publicKey.toBase58(),
  });
  console.log(`\nDone. Public keys written to ${out}.`);
  console.log("\nAdd these to .env.local (and Vercel) so the app labels the demo wallets:\n");
  console.log(`NEXT_PUBLIC_PROGRAM_ID=${program.programId.toBase58()}`);
  console.log(`NEXT_PUBLIC_DEMO_WALLETS='${env}'\n`);
  console.table(SCENARIO.map((s) => ({ serial: s.serial, target: s.target, note: s.note })));
}

main().catch((e) => {
  console.error("\n✗ Seed failed:", e?.error?.errorCode?.code ?? e?.message ?? e);
  if (e?.logs) console.error(e.logs.join("\n"));
  process.exit(1);
});
