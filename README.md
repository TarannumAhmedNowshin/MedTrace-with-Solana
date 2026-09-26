# MedTrace

Anti-counterfeit medicine tracing on Solana — every pack gets a unique serial with a public lifecycle (**minted → handed off → dispensed**), so a photocopied QR is caught at scan time.

*Build IRL Vol. 1 · Solana Hackathon · Dogpatch Labs, Dublin · 26 Sep 2026*

## Repo layout (each person owns a folder)

```
medtrace/
├── program/                     P1 · Anchor source (mirrors Solana Playground)
│   ├── src/lib.rs               the onchain program
│   ├── tests/anchor.test.ts     Playground test file
│   └── Cargo.toml               local `cargo check` only
├── app/                         P2 · Next.js app (Vercel)
│   └── src/
│       ├── idl/                 P1 · IDL, Program ID, locked interface contract
│       ├── lib/                 P2 · medtrace.ts (real) + medtrace.mock.ts
│       └── app/
│           ├── (roles)/         P2 · manufacturer / distributor / pharmacy screens
│           └── verify/          P3 · patient scan page
├── demo/                        P3 · QR files, demo script, backup video link
└── docs/                        planning docs
```

## Interface contract (locked 10:30)

| Item | Value |
|---|---|
| Instructions | `mint_pack(serial, batch, expiry)` · `transfer_custody(new_holder)` · `dispense()` |
| Pack fields | `serial, batch, expiry, manufacturer, holder, status, dispensed_at` |
| Status | `Manufactured, InTransit, AtPharmacy, Dispensed` |
| Verdicts | `GENUINE` · `OTHER_PHARMACY` · `ALREADY_DISPENSED` · `UNKNOWN` |
| Serial | `SQ-000123` (≤ 32 chars) · PDA seeds `["pack", serial]` |
| QR | `https://<vercel-url>/verify/SQ-000123` |

Types and the verdict rule live in [`app/src/idl/contract.ts`](app/src/idl/contract.ts) — import from there, don't redefine.

## Git rules
- Branch per person (`p1-program`, `p2-roles`, `p3-verify`) → small PRs → `main`
- Only touch your own folder; `app/src/lib/medtrace.ts` changes go through P2
- **Never commit keypairs or seed phrases**
- `npm run build` must pass before merging — `main` is the live demo

## Links
| | |
|---|---|
| Program ID | *pending deploy* |
| Explorer | *pending deploy* |
| Vercel | *fill in* |
| Deck | *fill in* |
