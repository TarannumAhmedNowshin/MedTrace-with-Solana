# MedTrace: Solana program (Anchor)

One `Pack` account (PDA `["pack", serial]`) per medicine pack.
Custody: **Manufactured → InTransit → AtPharmacy → Dispensed**. A pack can be dispensed **exactly once**, so a photocopied QR code scanned later shows *already dispensed*.

Spec: `../docs/MedTrace_Tech_Design.md` §3 and §3A. Repo-level scripts (seed, contract check, Playground flattening) live in `../scripts/`. Run them with `npm run …` from the repo root.

```
anchor/
├── programs/medtrace/src/
│   ├── lib.rs          ← Anchor program: accounts, instructions, events, errors
│   └── rules.rs        ← all business rules, pure Rust (no Anchor), unit-tested
├── playground/
│   ├── lib.rs          ← GENERATED single file for Solana Playground (lib.rs + rules.rs)
│   └── tests/medtrace.test.ts   ← Playground "Test" tab (devnet)
├── tests/medtrace.ts   ← `anchor test` suite (local validator)
├── idl/medtrace.json   ← the IDL the app uses (commit the deployed one here)
├── rules-tests/        ← `cargo test` harness for rules.rs (zero deps, works offline)
└── tools/offline-check ← stub-based type-check of lib.rs without crates.io (NOT real Anchor)
```

## Instructions

| Instruction | Signer | Accounts | Effect | Errors |
|---|---|---|---|---|
| `mint_pack(serial, batch, expiry)` | manufacturer (pays rent) | `pack`, `manufacturer`, `system_program` | new Pack, holder = manufacturer, `Manufactured` | `InvalidSerial` `InvalidBatch` `AlreadyExpired`; duplicate serial → "already in use" |
| `transfer_custody(new_holder)` | current holder | `pack`, `holder` | holder = new_holder; status +1 hop | `NotHolder` `SameHolder` `InvalidStatus` `AlreadyDispensed` |
| `dispense()` | current holder | `pack`, `holder` | `Dispensed`, `dispensed_at = now` | `NotHolder` `NotAtPharmacy` `AlreadyDispensed` |

**Serials** must be 1–32 characters of `A-Z 0-9 -`. The program enforces uppercase so nobody can register a look-alike `sq-000123` next to `SQ-000123`.
**Layout** keeps the fixed fields first (`holder` @ byte 40, `status` @ byte 72) so the app can filter by holder or status with RPC memcmp. **Don't reorder fields after deploying.**
**Events:** `PackMinted`, `CustodyTransferred`, `PackDispensed` (for a future indexer).

---

## Runbook: deploy from Solana Playground (P1, ~15 min)

1. Open **https://beta.solpg.io** → *Create a new project* → framework **Anchor**, name `medtrace`.
2. Replace `src/lib.rs` with the contents of **`anchor/playground/lib.rs`**.
3. Bottom-left: connect the **Playground wallet** and set the cluster to **devnet**. Run `solana airdrop 2` in the terminal (or use https://faucet.solana.com). A deploy needs about 2–3 SOL.
4. **Build**. Playground writes your program ID into `declare_id!`.
5. **Deploy**. Post the **program ID + Explorer link** in the team chat.
6. **Test tab**: add `tests/medtrace.test.ts` from `anchor/playground/tests/`, then run it. All 6 should pass. Each prints Explorer links.
7. **Export the IDL** (Build panel → Export IDL). Commit it as **`anchor/idl/medtrace.json`**, then run from the repo root:
   ```bash
   npm run contract     # must print "Contract OK"
   ```
   The app now switches to Solana automatically (mode `auto` sees a real program ID).
8. Optional: **Upload the IDL onchain** (Build panel → Upload IDL) so Solana Explorer decodes Pack data for judges.
9. **Back up the Playground wallet** (Settings → Export keypair). It is the program's **upgrade authority**. Keep it offline and never commit it.

> If Playground reports an old Anchor version and `ctx.bumps.pack` fails to compile, replace it with `*ctx.bumps.get("pack").unwrap()` (Anchor ≤ 0.28). If the exported IDL has no top-level `"address"` (legacy format), set `NEXT_PUBLIC_PROGRAM_ID` and follow the note at the top of `src/lib/medtrace/onchain.ts`.

## Runbook: seed the demo state (≥ 10 min before judging)

Needs 4 funded devnet wallets: Phantom accounts named Manufacturer, Distributor, Pharmacy and Other Pharmacy, with ≥ 0.2 SOL each and ≥ 0.5 SOL for the manufacturer.

```bash
npm install                                    # repo root
export RPC_URL=https://api.devnet.solana.com   # or your Helius devnet URL
export MFR_SECRET='…' DIST_SECRET='…' PHARM_SECRET='…' OTHER_PHARM_SECRET='…'   # Phantom → Export Private Key
npm run seed
```

It creates the same scenario as the app's mock data, so the screens look identical on real data:

| Serial | State | Demo role |
|---|---|---|
| SQ-000101 | AtPharmacy | genuine, ready |
| SQ-000103 | Dispensed | **the clone** (must be > 10 min old) |
| SQ-000104 | AtPharmacy (other pharmacy) | OTHER_PHARMACY |
| SQ-000105 | InTransit | supply chain |
| SQ-000106 | Manufactured | fresh |
| SQ-000110–112 | AtPharmacy | **spares for the live dispense** |

The script is idempotent. At the end it prints two lines (`NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_DEMO_WALLETS`) for `.env.local` and Vercel. They contain **public keys only**.

## Switch the app to chain

Nothing to flip: with the deployed IDL committed, `NEXT_PUBLIC_MEDTRACE_MODE=auto` (default) uses Solana.
Optionally set `RPC_URL=<helius devnet url>` (server-only). Then open **/status** in the app and run `npm run smoke -- SQ-000101`.

## Local development (optional; needs Rust + Solana + Anchor 0.31 CLI)

```bash
npm run anchor:build            # anchor build + copies the IDL to anchor/idl/
cd anchor && anchor keys sync && cd .. && npm run anchor:build
npm run anchor:test             # tests/medtrace.ts on a local validator
# point the app at localnet: NEXT_PUBLIC_CLUSTER=localnet (run `npm run anchor:localnet` in another terminal)
```

## Checks that run anywhere (no Solana toolchain)

```bash
npm run program:rules       # 8 rule tests (cargo, zero deps)
npm run program:check       # compile check against the offline stub
npm run contract            # program ⇄ IDL ⇄ app
npm run program:playground  # regenerate playground/lib.rs
```

Edit `programs/medtrace/src/*.rs`, then run `npm run program:playground`. Never edit the generated file directly.
