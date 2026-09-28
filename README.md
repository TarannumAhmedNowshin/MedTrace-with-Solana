# MedTrace

**Anti-counterfeit medicine tracing on Solana.** Every medicine pack gets a unique serial and a public, append-only lifecycle: *minted → handed off → dispensed*. A pack can be dispensed exactly once, so a photocopied QR code is caught the moment someone scans it.

| | |
|---|---|
| **Live app** | https://medtrace-with-solana.vercel.app |
| **Program (devnet)** | [`GYR4Sa8NLqB5uSbZvJE3hvZ29cbK3i5tqmEWzi2tjHpo`](https://explorer.solana.com/address/GYR4Sa8NLqB5uSbZvJE3hvZ29cbK3i5tqmEWzi2tjHpo?cluster=devnet) |
| **Health check** | [`/status`](https://medtrace-with-solana.vercel.app/status) · [`/api/health`](https://medtrace-with-solana.vercel.app/api/health) |
| **Try it** | [`/verify/SQ-000101`](https://medtrace-with-solana.vercel.app/verify/SQ-000101) (genuine) · [`/verify/SQ-000103`](https://medtrace-with-solana.vercel.app/verify/SQ-000103) (cloned code) |

*Built at Build IRL Vol. 1, the Solana hackathon at Dogpatch Labs, Dublin, on 26 Sep 2026.*

---

## The problem

In low- and middle-income countries, at least 1 in 10 medicines is substandard or falsified (WHO). In Bangladesh, fake antibiotics, syrups and heart, diabetes and cancer drugs move through a fragmented supply chain: manufacturer → distributor → wholesale hubs → more than 250,000 pharmacies. No single party has an end-to-end view of that chain.

Current fixes don't close the gap:

- **A static QR code proves that a code exists. It doesn't prove this box is the only one carrying it.** One genuine code photocopied onto 10,000 fakes still scans as "genuine".
- **Per-manufacturer verification apps** create more than 200 silos, and each manufacturer is the only judge of its own data.
- **Raids and lab tests** are reactive, and they don't scale to 250,000 shops.

**MedTrace protects the lifecycle rather than the code.** A clone scans fine, but the chain answers with *already dispensed*, *held by another pharmacy* or *never registered*.

### Why a blockchain and not a database?

The problem involves many parties who don't trust each other: manufacturers, distributors, pharmacies and the regulator (DGDA) all need to write to **one neutral record**, and dishonest manufacturers are part of the threat model. Solana adds three things:

- **One verification layer** across every manufacturer.
- **A tamper-evident audit trail** for recalls and prosecutions.
- **Per-event costs low enough** to track individual packs.

Patients never need a wallet. Verifying a pack is a free read.

---

## How it works

```
 Manufacturer          Distributor           Pharmacy              Patient
 (wallet)              (wallet)              (wallet)              (no wallet)
    │ mint_pack           │ transfer_custody    │ dispense            │ scan QR → /verify/:serial
    ▼                     ▼                     ▼                     ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Next.js app (Vercel)                                                    │
 │   writes: signed in Phantom → Solana     reads: server → RPC → verdict   │
 └──────────────────────────────────────────────────────────────────────────┘
                                   │
                         MedTrace program (Anchor)
                         one Pack PDA per serial: ["pack", serial]
```

### Pack lifecycle

```
Manufactured ──transfer──▶ InTransit ──transfer──▶ AtPharmacy ──dispense──▶ Dispensed (terminal)
```

- **Uniqueness is enforced by the runtime, not by our code.** The Pack address is a PDA derived from `["pack", serial]`, and `init` fails if that account already exists. A serial can be minted only once.
- **Custody is enforced by signature.** `has_one = holder` plus `Signer` means only the current holder can move or sell a pack.
- **A pack can be dispensed once.** A second `dispense()` reverts, so a clone can't be "sold" again.

### Verdict rules

Implemented in `src/lib/medtrace/verdict.ts`, as pure functions with unit tests:

| On-chain state when scanned | Verdict | Patient sees |
|---|---|---|
| No account at the PDA | `UNKNOWN` | Not registered: this box may be fake |
| `Dispensed` more than 10 minutes ago | `ALREADY_DISPENSED` | **Code already used**: this box may be a copy |
| `Dispensed` within the last 10 minutes | `GENUINE` | Dispensed to you just now |
| Held by a different pharmacy than the one scanning (`?pharmacy=`) | `OTHER_PHARMACY` | Registered to another pharmacy |
| Otherwise | `GENUINE` | Registered and in the supply chain or at the pharmacy |

The 10-minute grace window (`FRESH_DISPENSE_SECONDS`) lets the patient who just bought the pack scan it and see a green result.

---

## Repository layout

```
.
├── src/                        Next.js 16 app (App Router): UI + REST API
│   ├── app/                    routes: role screens, /verify, /qr, /status, /api/*
│   ├── features/               manufacturer · distributor · pharmacy · regulator · QR screens
│   ├── components/ hooks/      shared UI, data hooks (TanStack Query), wallet actor
│   └── lib/medtrace/           data layer: config, client, mock store, Solana adapter, verdict rules
├── anchor/
│   ├── programs/medtrace/src/  lib.rs (accounts, instructions, events) + rules.rs (pure business rules)
│   ├── idl/medtrace.json       IDL the app reads; its "address" is the deployed program ID
│   ├── playground/             single-file build for Solana Playground (generated)
│   ├── rules-tests/            cargo tests for rules.rs, no Solana toolchain needed
│   └── tests/                  Anchor test suite (local validator)
├── scripts/                    seed, smoke, contract check, key generator, SOL recovery
├── tests/                      app unit tests (vitest)
├── docs/                       problem statement, tech design, frontend plan, team plan
└── .github/workflows/ci.yml    rules + contract + app test + build on every push/PR
```

### Architectural boundaries

These boundaries are deliberate. Keep them when you change the code.

- **Screens never import Solana code.** They go through `MedTraceClient` (`src/lib/medtrace/client.ts`).
- **`onchain.ts` is the only module that imports Anchor.** `mapper.ts` is the only module that touches `BN` or `PublicKey`.
- **The mock store mirrors the program exactly.** `mockStore.ts` enforces the same state machine and error names as `rules.rs`, so the UI behaves the same with or without a chain.
- **`npm run contract` guards drift.** It fails if the program, the IDL and the app disagree on error codes, account layout, memcmp offsets, instruction or account names, or PDA seeds.
- **The Pack account layout is frozen.** Fixed-size fields come first (`holder` at byte 40, `status` at byte 72) so the app can filter with RPC `memcmp`. Never reorder fields after a deploy.

---

## On-chain program

| Instruction | Signer | Effect | Errors |
|---|---|---|---|
| `mint_pack(serial, batch, expiry)` | manufacturer (pays rent) | creates Pack; holder = manufacturer; `Manufactured` | `InvalidSerial` `InvalidBatch` `AlreadyExpired`; duplicate serial → *already in use* |
| `transfer_custody(new_holder)` | current holder | holder = `new_holder`; status advances one hop | `NotHolder` `SameHolder` `InvalidStatus` `AlreadyDispensed` |
| `dispense()` | current holder | `Dispensed`, `dispensed_at = now` | `NotHolder` `NotAtPharmacy` `AlreadyDispensed` |

- **Serials** are 1–32 characters of `A-Z 0-9 -`. Uppercase is required, so nobody can register a look-alike `sq-000123` next to `SQ-000123`.
- **Events:** `PackMinted`, `CustodyTransferred` and `PackDispensed`, for a future indexer and hotspot analytics.
- **Cost:** about 0.002 SOL of rent per pack, which can be reclaimed after dispense on the roadmap.

---

## Getting started

**Requirements:** Node **22.x** (see [Troubleshooting](#troubleshooting) for older Node), npm, and optionally Rust for the program tests.

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

Out of the box the app runs in **mock mode**, with in-memory data and the program's exact rules. Pick an identity from the *Acting as* menu. No wallet or chain is needed.

### Configuration

The app has one switch, `NEXT_PUBLIC_MEDTRACE_MODE`:

| Value | Reads | Writes |
|---|---|---|
| `auto` *(default)* | Solana if a real program ID is configured, else mock | same |
| `solana` | MedTrace program via RPC (server-side, through `/api`) | signed in Phantom, sent straight to Solana |
| `mock` | in-memory store | `/api/mock/tx/*` |

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_MEDTRACE_MODE` | public | `auto` · `solana` · `mock` |
| `NEXT_PUBLIC_CLUSTER` | public | `devnet` (default) · `localnet` · `testnet` · `mainnet-beta` |
| `NEXT_PUBLIC_PROGRAM_ID` | public | overrides the IDL `address` |
| `NEXT_PUBLIC_DEMO_WALLETS` | public | JSON of demo **public keys**, printed by `npm run seed` |
| `NEXT_PUBLIC_APP_URL` | public | base URL printed into every QR code; set it before printing |
| `NEXT_PUBLIC_RPC_URL` | public | browser RPC (defaults per cluster) |
| `RPC_URL` | **server only** | private RPC, e.g. Helius. Never prefix it with `NEXT_PUBLIC_`. |

`NEXT_PUBLIC_*` values are inlined at build time, so **redeploy after changing any of them**.

---

## Going live on devnet

1. **Deploy the program.** In [Solana Playground](https://beta.solpg.io), paste `anchor/playground/lib.rs` into `src/lib.rs`, click **Build**, then **Deploy**. Full runbook: [`anchor/README.md`](anchor/README.md).
   > ⚠️ **Build again after the first build, before you deploy.** Playground writes the real program ID into `declare_id!` during the first build, so a binary built from the placeholder will reject every call with `DeclaredProgramIdMismatch`. The rule is: build → check that `declare_id!` shows your ID → build again → deploy.
2. **Point the app at it.** Put the program ID in `"address"` in `anchor/idl/medtrace.json` (the top-level one only; leave the System Program address alone), and in `declare_id!` in `anchor/programs/medtrace/src/lib.rs` and `anchor/Anchor.toml`. Then run:
   ```bash
   npm run contract            # must print: Contract OK
   ```
3. **Create the demo wallets.** Manufacturer, distributor, pharmacy and other pharmacy, each funded with about 0.1 SOL:
   ```bash
   node scripts/gen-demo-keys.mjs MFR DIST PHARM OTHER_PHARM   # prints addresses + export lines
   ```
4. **Seed the demo state.** The seed is idempotent, so a re-run resumes where it stopped:
   ```bash
   export MFR_SECRET=… DIST_SECRET=… PHARM_SECRET=… OTHER_PHARM_SECRET=…   # base58 or JSON byte array
   npm run seed
   ```
   Seed **at least 10 minutes before a demo**, so that SQ-000103 reads as *already dispensed*.
5. **Deploy the app.** Import the repo into Vercel, leave the root directory empty, set the env vars above, and deploy. Then check that every row on `/status` is green.

### Demo data (created by the seed)

| Serial | State | Shows |
|---|---|---|
| `SQ-000101` | AtPharmacy | ✅ Genuine |
| `SQ-000103` | Dispensed earlier | 🚫 **Code already used**: the cloned box |
| `SQ-000104` | AtPharmacy (other pharmacy) | ⚠️ Registered to another pharmacy (`?pharmacy=<main pharmacy>`) |
| `SQ-000105` | InTransit | ✅ Genuine, in the supply chain |
| `SQ-000106` | Manufactured | ✅ Genuine, fresh mint |
| `SQ-000110`–`112` | AtPharmacy | spares for a live dispense on stage |

### Demo script (under 60 seconds)

1. The patient scans the genuine box (**SQ-000101**) and sees ✅ **Genuine**.
2. The pharmacy dispenses a spare (**SQ-000110**) in Phantom. Show the Explorer link.
3. Scan the photocopied box (**SQ-000103**). It shows 🚫 **Code already used**.
4. Point out that the counterfeiter couldn't prevent this, because they can't sign as the holder.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` · `build` · `start` | Next.js |
| `npm test` | app unit tests: verdict, mapper, mock store, errors |
| `npm run test:all` | app tests + program rule tests + contract check |
| `npm run program:rules` | `cargo test` of `rules.rs` (no Solana toolchain needed) |
| `npm run program:playground` | regenerate `anchor/playground/lib.rs` after editing the program |
| `npm run contract` | program ⇄ IDL ⇄ app consistency check |
| `npm run seed` | put devnet into the demo state (idempotent) |
| `npm run smoke -- <serial>` | read one pack + verdict straight from chain |
| `node scripts/gen-demo-keys.mjs <NAMES…>` | generate demo keypairs with Node's crypto (no dependencies) |
| `npx tsx scripts/recover-sol.ts [--close] [--close-old-program]` | reclaim SOL locked in failed-deploy buffers (dry run by default) |
| `npm run anchor:build` · `anchor:test` · `anchor:deploy` · `anchor:localnet` | Anchor CLI workflows |

### REST API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/packs?holder=&status=` | `Pack[]` |
| GET | `/api/packs/:serial` | `Pack` or 404 |
| GET | `/api/packs/:serial/verdict?pharmacy=` | `VerdictResult` |
| GET | `/api/health` | mode, cluster, program ID, RPC and deployment status |
| POST | `/api/mock/tx/{mint,transfer,dispense}` | mock mode only |

---

## Testing

| Layer | How | Status |
|---|---|---|
| Business rules (Rust) | `npm run program:rules` | 8/8 |
| App logic | `npm test` | 24/24 |
| Program ⇄ IDL ⇄ app | `npm run contract` | Contract OK |
| On-chain (devnet) | Playground test file: mint, duplicate rejected, transfer, non-holder rejected, dispense, double-dispense rejected | 7/7 |
| End to end | `npm run seed` + `/verify` on the live deployment | ✅ |

CI (`.github/workflows/ci.yml`) runs the rules tests, the contract check, a check that the Playground file is up to date, the app tests and a production build on every push and pull request.

---

## Troubleshooting

These are real issues we hit, with their fixes.

| Symptom | Cause → fix |
|---|---|
| `DeclaredProgramIdMismatch` (error 4100) on every call | The binary was built with the placeholder `declare_id!`. **Build again, then Deploy**; the upgrade keeps the same program ID. |
| `ERR_REQUIRE_ESM … rpc-websockets … uuid` | Node < 20.19 can't `require()` the ESM-only `uuid`. It's fixed in `package.json` (`overrides` pins `uuid@11` for `rpc-websockets`, and `engines.node = 22.x`). Locally, use Node 22 or `npx -y -p node@22 -- node …`. |
| `/verify` shows "Network busy" | The server reader threw. Open `/api/packs/<serial>/verdict` to see the real error. |
| A read straight after a write returns the old state | Public devnet RPC nodes lag behind. Re-fetch at `"confirmed"` until the change appears; the tests poll for this. |
| Deploy: *Buffer account not owned by loader*, or balance suddenly lower | A failed deploy left SOL in a buffer. Run `scripts/recover-sol.ts` (dry run first, then `--close`). |
| *Reached rate-limits* during deploy | Normal on public devnet; a deploy takes about 7–8 minutes. For anything heavier, use a private RPC (`RPC_URL`). |
| `bad secret key size` in the seed | You passed an **address**, not a secret key. Export the keypair JSON from Playground or the private key from Phantom. |
| Explorer links open mainnet | `NEXT_PUBLIC_CLUSTER` is empty. It now defaults to `devnet`; redeploy. |

---

## Security notes

- **No patient data goes on-chain**, only pack lifecycle events. Patient scans are reads and aren't recorded.
- **Nothing secret lives in this repo.** The program ID, IDL and wallet addresses are public by design (they're on-chain). Keypairs are passed through environment variables only; `*.keypair.json`, `demo-wallets.json` and `.env*` are gitignored, and `NEXT_PUBLIC_DEMO_WALLETS` holds **public keys** only.
- **The only server secret is `RPC_URL`.** It's read only on the server (`src/lib/medtrace/server.ts`) and never sent to the browser. Store it in Vercel as a **Secret**-type variable with no `NEXT_PUBLIC_` prefix.
- **API hardening:**
  - Error responses never expose internals. 5xx errors return a generic message, and details are logged server-side after redaction (`redact.ts` strips URLs, API keys and paths).
  - Query parameters (`holder`, `pharmacy`, serials) are validated.
  - The list endpoint is edge-cached for 5 seconds, so bursts can't hammer the RPC.
  - `/api/mock/tx/*` returns 403 unless the app runs in mock mode.
- **HTTP security headers** are set in `next.config.ts`: `X-Frame-Options`/`frame-ancestors` (no clickjacking), `nosniff`, HSTS, `Referrer-Policy` and `Permissions-Policy`. The `X-Powered-By` header is off.
- **All writes are signed by the user's wallet** in Phantom, and the server never holds a signing key.
- **Known gap:** any wallet can call `mint_pack` today. The fix is a regulator-approved manufacturer registry (see the roadmap).
- **Reporting a vulnerability:** please open a private security advisory on GitHub rather than a public issue.

## Scope and limitations

- **Out of scope:** substandard drugs from a registered manufacturer (a genuine pack of bad quality still needs lab testing), and unserialized stock already on the market.
- **Adoption** (manufacturers serializing packs, pharmacies scanning them) is a business challenge rather than a technical one.
- **Regulatory fit:** this is a non-payment use (records and verification), which is the lower-risk lane under Bangladesh's 2026 National Blockchain Policy.

## Roadmap

1. **Manufacturer registry:** a registry PDA controlled by a regulator (DGDA) authority key, so only approved wallets can mint.
2. **Cost at scale:** close Pack accounts after dispense to reclaim rent, and move to state compression for national volumes.
3. **UX:** custodial backend keys for pharmacies, so pharmacies and patients never touch crypto.
4. **Physical layer:** scratch-off codes and tamper-evident seals, aligned with GS1 DataMatrix.
5. **Regulator analytics:** index the program's events to map where failed and duplicate scans cluster (hotspots).

## Documentation

- [`docs/MedTrace_Problem_and_Tech.md`](docs/MedTrace_Problem_and_Tech.md): problem statement, stakeholders and sources
- [`docs/MedTrace_Tech_Design.md`](docs/MedTrace_Tech_Design.md): technical design and ADRs
- [`docs/MedTrace_Frontend_Plan.md`](docs/MedTrace_Frontend_Plan.md): frontend plan
- [`anchor/README.md`](anchor/README.md): program reference and Playground deploy runbook
