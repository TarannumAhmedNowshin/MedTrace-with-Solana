# MedTrace

Anti-counterfeit medicine tracking on Solana. Every pack is registered on-chain, custody moves manufacturer → distributor → pharmacy with signed transactions, and a pack can be dispensed **once**. When a patient scans the QR code they see *Genuine*. When anyone scans a photocopied code later, they see *Code already used*.

One repo, one `package.json`:

```
medtrace/
├── src/                     Next.js 16 app (UI + REST API)
│   ├── app/                 routes: roles, /verify, /qr, /status, /api/*
│   ├── features/            screens (manufacturer, distributor, pharmacy, regulator, QR)
│   ├── components/ hooks/   shared UI + data hooks (TanStack Query)
│   └── lib/medtrace/        data layer: config, client, mock store, Solana adapter, verdict rules
├── anchor/                  Solana program (Anchor)
│   ├── programs/medtrace/   lib.rs + rules.rs
│   ├── idl/medtrace.json    ← the IDL the app reads (program ID lives here)
│   ├── playground/          single-file build + tests for Solana Playground
│   └── tests/               anchor test suite
├── scripts/                 seed-demo, smoke, contract check, Playground flattening
├── tests/                   app unit tests (vitest)
└── docs/                    tech design + frontend plan
```

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

With no program deployed yet, the app runs in **mock mode**. It uses in-memory demo data with exactly the program's rules, and you pick an identity from the "Acting as" menu. Everything works end to end, including the patient verify page.

## Connect to Solana

The app has one switch, `NEXT_PUBLIC_MEDTRACE_MODE`:

| Value | Reads | Writes |
|---|---|---|
| `auto` *(default)* | Solana if a real program ID is configured, otherwise mock | same |
| `solana` | MedTrace program via RPC (server-side, through `/api`) | signed in **Phantom**, sent straight to Solana |
| `mock` | in-memory store | `/api/mock/tx/*` |

To go live on devnet:

1. **Deploy the program** from Solana Playground (see `anchor/README.md`, about 15 min), or run `npm run anchor:deploy` with the Anchor CLI.
2. **Commit the deployed IDL** to `anchor/idl/medtrace.json` and run `npm run contract` (must print *Contract OK*). Mode `auto` now switches to Solana.
3. **Seed the demo state:** `npm run seed` with the 4 demo wallets' secrets in env. It prints `NEXT_PUBLIC_PROGRAM_ID` and `NEXT_PUBLIC_DEMO_WALLETS` lines. Paste them into `.env.local` / Vercel.
4. Optional: set `RPC_URL` to a Helius devnet URL (server-only) to avoid public RPC rate limits.
5. Open **`/status`**. Data mode, RPC and the program should all be green. Then run `npm run smoke -- SQ-000101`.

In Phantom: switch to **devnet** (Settings → Developer settings). The app shows your balance and has a **Get 1 test SOL** button on test clusters.

**Local validator:** `npm run anchor:localnet` in one terminal, `NEXT_PUBLIC_CLUSTER=localnet` in `.env.local`. Explorer links point at your local node.

## How the pieces talk

```
Browser (role screens)                 Next.js server                        Solana
───────────────────────                ──────────────                        ──────
reads  → /api/packs/*  ─────────────▶  serverReader() ─▶ onchain.ts ─RPC─▶  MedTrace program
writes → Phantom signs (Anchor) ──────────────────────────────────────────▶ (Pack PDAs)
patient phone → /verify/:serial ────▶  Server Component → same reader → verdict (never cached)
```

* Screens never import Solana code. They use `MedTraceClient` (`src/lib/medtrace/client.ts`).
* `src/lib/medtrace/onchain.ts` is the only file that imports Anchor. `mapper.ts` is the only file that touches BN/PublicKey.
* The mock store (`mockStore.ts`) enforces the same state machine and error names as `anchor/programs/medtrace/src/rules.rs`.
* `npm run contract` fails if the program, IDL and app drift apart (error codes, account layout, memcmp offsets, account names).

### REST API
| Method | Path | Returns |
|---|---|---|
| GET | `/api/packs?holder=&status=` | `Pack[]` |
| GET | `/api/packs/:serial` | `Pack` or 404 |
| GET | `/api/packs/:serial/verdict?pharmacy=` | `VerdictResult` |
| GET | `/api/health` | mode, cluster, program ID, RPC + deployment status |
| POST | `/api/mock/tx/{mint,transfer,dispense}` | mock mode only |

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | app unit tests (verdict, mapper, mock store, errors) |
| `npm run test:all` | app tests + program rule tests + contract check |
| `npm run program:rules` | `cargo test` for the program's business rules (no Solana toolchain needed) |
| `npm run program:playground` | regenerate `anchor/playground/lib.rs` after editing the program |
| `npm run anchor:build` / `anchor:test` / `anchor:deploy` / `anchor:localnet` | Anchor CLI workflows |
| `npm run seed` | put devnet into the demo state (idempotent) |
| `npm run smoke -- <serial>` | read one pack + verdict straight from chain |
| `npm run contract` | program ⇄ IDL ⇄ app consistency check |

## Deploy to Vercel

Import the repo and set the env vars from `.env.example` (at least `NEXT_PUBLIC_APP_URL`, plus `RPC_URL` and `NEXT_PUBLIC_DEMO_WALLETS` for Solana mode). Redeploy after changing any `NEXT_PUBLIC_*` value.
Mock mode keeps state in server memory, so it's for local development. Use Solana mode on Vercel.

## Notes
* Demo wallet names in `src/lib/medtrace/config.ts` are fictional.
* `preview/` builds an offline single-file preview of the UI (used where npm isn't available). It isn't part of the app build.
