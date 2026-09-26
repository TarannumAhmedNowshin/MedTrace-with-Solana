/**
 * Recover devnet SOL locked by failed deploys (and, optionally, by the retired v1 program).
 *
 *   export MFR_SECRET="$(cat ~/Downloads/wallet-1-keypair.json)"   # the Playground / deploy wallet
 *   npx -y -p node@22 -- node ./node_modules/tsx/dist/cli.mjs scripts/recover-sol.ts            # dry run: shows what it would close
 *   npx -y -p node@22 -- node ./node_modules/tsx/dist/cli.mjs scripts/recover-sol.ts --close    # closes leftover deploy buffers
 *   ... scripts/recover-sol.ts --close --close-old-program                                        # ALSO closes retired v1 program 5B5Ph… (permanent)
 *
 * Closing only returns rent to the same wallet. It never touches the live program (GYR4…).
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const OLD_PROGRAM = new PublicKey("5B5PhT8S3btDAhR2y8uJR5o8NBqhi14LbghZwb5TT9i5"); // retired v1
const LIVE_PROGRAM = "GYR4Sa8NLqB5uSbZvJE3hvZ29cbK3i5tqmEWzi2tjHpo"; // never closed by this script

const args = process.argv.slice(2);
const CLOSE = args.includes("--close");
const CLOSE_OLD = args.includes("--close-old-program");

function loadKey(): Keypair {
  const raw = process.env.MFR_SECRET;
  if (!raw) throw new Error("Missing env MFR_SECRET (the deploy wallet)");
  const bytes = raw.trim().startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : utils.bytes.bs58.decode(raw.trim());
  return Keypair.fromSecretKey(bytes);
}

/** UpgradeableLoaderInstruction::Close = 5 (u32 LE). */
function closeIx(target: PublicKey, recipient: PublicKey, authority: PublicKey, program?: PublicKey) {
  const keys = [
    { pubkey: target, isSigner: false, isWritable: true },
    { pubkey: recipient, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];
  if (program) keys.push({ pubkey: program, isSigner: false, isWritable: true });
  const data = Buffer.alloc(4);
  data.writeUInt32LE(5, 0);
  return new TransactionInstruction({ programId: LOADER, keys, data });
}

const sol = (l: number) => (l / LAMPORTS_PER_SOL).toFixed(4);

async function main() {
  const wallet = loadKey();
  const conn = new Connection(RPC, "confirmed");
  console.log(`Wallet ${wallet.publicKey.toBase58()} · balance ${sol(await conn.getBalance(wallet.publicKey))} SOL`);

  const targets: { label: string; ix: TransactionInstruction; lamports: number }[] = [];

  // 1. Leftover buffers from failed deploys: state tag Buffer (=1), authority Some(wallet) at offset 5.
  try {
    const buffers = await conn.getProgramAccounts(LOADER, {
      filters: [
        { memcmp: { offset: 0, bytes: utils.bytes.bs58.encode(Uint8Array.from([1, 0, 0, 0])) } },
        { memcmp: { offset: 5, bytes: wallet.publicKey.toBase58() } },
      ],
      dataSlice: { offset: 0, length: 0 },
    });
    for (const b of buffers) {
      targets.push({ label: `buffer ${b.pubkey.toBase58()}`, ix: closeIx(b.pubkey, wallet.publicKey, wallet.publicKey), lamports: b.account.lamports });
    }
    if (!buffers.length) console.log("No leftover deploy buffers found.");
  } catch (e) {
    console.log(`Could not list buffers (public RPC may refuse this query): ${(e as Error).message}`);
  }

  // 2. Retired v1 program (opt-in, permanent).
  if (CLOSE_OLD) {
    const [programData] = PublicKey.findProgramAddressSync([OLD_PROGRAM.toBuffer()], LOADER);
    const info = await conn.getAccountInfo(programData);
    if (info) {
      targets.push({
        label: `retired program ${OLD_PROGRAM.toBase58()} (programdata ${programData.toBase58()})`,
        ix: closeIx(programData, wallet.publicKey, wallet.publicKey, OLD_PROGRAM),
        lamports: info.lamports,
      });
    } else console.log("Retired program already closed.");
  }

  if (targets.some((t) => t.label.includes(LIVE_PROGRAM))) throw new Error("Refusing to touch the live program");

  for (const t of targets) console.log(`  • ${t.label}: ${sol(t.lamports)} SOL`);
  const total = targets.reduce((s, t) => s + t.lamports, 0);
  console.log(`Recoverable: ${sol(total)} SOL`);
  if (!CLOSE) return console.log("\nDry run. Re-run with --close to reclaim it.");

  for (const t of targets) {
    try {
      const sig = await conn.sendTransaction(new Transaction().add(t.ix), [wallet]);
      await conn.confirmTransaction(sig, "confirmed");
      console.log(`✓ closed ${t.label}  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    } catch (e) {
      console.log(`✗ ${t.label}: ${(e as Error).message}`);
    }
  }
  console.log(`\nBalance now ${sol(await conn.getBalance(wallet.publicKey))} SOL`);
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
