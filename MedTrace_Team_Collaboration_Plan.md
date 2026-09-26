# MedTrace — 4-Person Cloud Collaboration Plan

*Build IRL Vol. 1 · Solana Hackathon · Dogpatch Labs, Dublin · Sat 26 Sep 2026 · 10:00–18:00*

---

## 1. Collaboration Setup

| Need | Tool | How the team uses it |
|---|---|---|
| **Source of truth** | **One GitHub repo** (`medtrace`) | Everyone added as collaborator; all code lives here |
| **Dev environments** | **GitHub Codespaces** — one per person | Each person opens their own codespace on the repo; usage counts against **each person's own free quota** (120 core-hours/month ≈ 60 hrs on 2-core) |
| **Onchain program** | **Solana Playground** (beta.solpg.io) — owned by P1 | Not real-time multi-user → **one owner** deploys; source also committed to `/program` |
| **Live demo** | **Vercel** linked to the repo | `main` = live demo URL; **every branch gets a preview URL** |
| **Deck** | **PowerPoint for the web** (free Microsoft account) | Real-time co-editing, saves **natively as .pptx** (submission requires .pptx) |
| **Comms** | WhatsApp / Discord group | Pin: Program ID, Vercel URL, deck link, repo link |

### Repo structure (each person owns a folder → minimal merge conflicts)

```
medtrace/
├── program/                     ← P1: Anchor source (mirrors Playground)
├── app/                         ← Next.js (deployed on Vercel)
│   ├── src/idl/medtrace.json    ← P1 commits IDL + Program ID here
│   ├── src/lib/medtrace.ts      ← P2: shared client (mint/transfer/dispense/verify)
│   ├── src/lib/medtrace.mock.ts ← P2: mock version for early UI work
│   ├── src/app/(roles)/         ← P2: manufacturer / distributor / pharmacy screens
│   └── src/app/verify/          ← P3: patient scan page
├── demo/                        ← P3: QR files, demo script, backup video link
└── docs/MedTrace_Problem_and_Tech.md
```

### Git rules
- **Feature branch per person** (`p2-roles`, `p3-verify`) → small PRs → merge to `main`
- **Only touch your own folder**; changes to shared `lib/medtrace.ts` go through P2
- **Never commit keypairs or secrets** — wallets stay in Phantom / Playground; backend keys go in Vercel env vars
- `npm run build` must pass before merging — `main` is the live demo

### Codespaces hygiene
- Use **2-core** machines
- Set **idle timeout = 30 min** (GitHub → Settings → Codespaces)
- **Stop** your codespace at lunch and at the end of the day

---

## 2. The Key Unblocker — Interface Contract (agreed at 10:30)

Agree this as a team so frontend work starts before the program is deployed.

| Item | Agreed value |
|---|---|
| Instructions | `mint_pack(serial, batch, expiry)` · `transfer_custody(new_holder)` · `dispense()` |
| Pack fields | `serial, batch, expiry, manufacturer, holder, status, dispensed_at` |
| Status enum | `Manufactured, InTransit, AtPharmacy, Dispensed` |
| Verify verdicts | `GENUINE` · `OTHER_PHARMACY` · `ALREADY_DISPENSED` · `UNKNOWN` |
| Serial format | `SQ-000123` (≤ 32 chars) |
| QR content | `https://<vercel-url>/verify/SQ-000123` |

P2 builds `medtrace.mock.ts` against this contract → **P2 and P3 build UI from 10:45 on mock data** → swap to the real client once P1 ships the IDL.

---

## 3. Roles & Work Split

### 👤 P1 — Program Lead (Solana Playground)
**Owns:** everything onchain · **Best fit:** most comfortable with Rust / backend logic

| Task | Done when |
|---|---|
| Write Anchor program (3 instructions, Pack account, errors) | Builds in Playground |
| Deploy to devnet | Program ID + Explorer link posted in chat |
| Test each instruction in Playground **Test** tab | mint → transfer → dispense works; double-dispense **fails** |
| Export **IDL**, commit with Program ID to `app/src/idl/` | P2 can import it |
| Fund & share **3 demo role wallets** (Phantom, devnet) | Demo laptop has all 3 |
| *Stretch:* manufacturer registry (regulator-approved minting) | Only approved wallets can mint |

### 👤 P2 — Integration & Role Screens (Codespaces)
**Owns:** client library + supply-chain UI · **Best fit:** strongest TypeScript / React

| Task | Done when |
|---|---|
| Next.js setup, Phantom wallet-connect, devnet RPC | Wallet connects on Vercel URL |
| `lib/medtrace.mock.ts` (by 10:45) | P3 can build against it |
| `lib/medtrace.ts` — real calls using IDL | Mock swapped; real transactions confirm |
| **Manufacturer screen** — mint pack, show serial + QR | New pack visible on Explorer |
| **Distributor / Pharmacy screens** — transfer, dispense | Status changes reflected onchain |
| **Explorer link** after every transaction | Clickable proof in demo |

### 👤 P3 — Patient Experience & Demo (Codespaces)
**Owns:** the "wow" moment + demo reliability · **Best fit:** frontend / UX-minded

| Task | Done when |
|---|---|
| `/verify/[serial]` page — fetch Pack → big verdict (✅ / ⚠️ / 🚫) | Works on a **phone** via QR |
| Mobile-first layout; Bangla + English verdict labels | Readable at arm's length |
| QR generation + **printed props**: genuine box + photocopied clone | Physical demo props ready |
| Vercel deploy owner — keep `main` green | Live URL always works |
| **Demo script** (mint → transfer → dispense → scan clone → 🚫) | Rehearsed, < 60 s |
| **Backup demo video** (record full flow ~15:30) | Saved locally + in `/demo` |
| *Stretch:* simple regulator view listing packs & statuses | One extra screen |

### 👤 P4 — Pitch & Product Lead (PowerPoint for the web)
**Owns:** story, deck, QA, submission · **Best fit:** strongest communicator / product thinker

| Task | Done when |
|---|---|
| Deck skeleton: Problem → Solution → How Solana → Demo → Potential → Team | Shared link posted by 10:45 |
| Problem & solution slides from `docs/MedTrace_Problem_and_Tech.md` (sourced stats only) | Slides 1–2 final by 12:30 |
| **"Why Solana, not a database"** slide | One clear diagram |
| Capture screenshots + Explorer links from P2 / P3 as they land | Tech & demo slides populated |
| Potential / roadmap slide (governance, compression, GS1, adoption) | Assumptions labelled |
| **QA tester** — run full flow at each checkpoint, log bugs in chat | Breakage caught before judges |
| ≥ 2 rehearsals, timed to **3 min**; **submit .pptx** at tally.so/r/rj7oqN | Submitted early |

---

## 4. Timeline by Person

| Time | P1 Program | P2 Integration | P3 Patient / Demo | P4 Pitch |
|---|---|---|---|---|
| **10:00–10:30** | Setup Playground, fund wallets | Codespace, Next.js, Vercel | Codespace, QR lib | Deck skeleton |
| **10:30–10:45** | 🤝 **Whole team: agree interface contract** | ← | ← | ← |
| **10:45–12:00** | Write + deploy `mint_pack` | Mock client + wallet connect | Verify page on mocks | Problem + solution slides |
| **12:00–13:00** | `transfer` + `dispense`, test, **ship IDL** | Manufacturer screen | QR props, mobile polish | "Why Solana" slide |
| **13:00–13:30** | 🍽 Lunch + **integration sync** | Swap mock → real client | Connect verify to real data | QA first real flow |
| **13:30–15:30** | Help P2 debug; stretch: registry | Distributor + pharmacy screens | Demo script; regulator view (stretch) | Screenshots → slides |
| **15:30** | ❄️ **Feature freeze** | Bug fixes only | **Record backup video** | Full QA run |
| **15:30–17:00** | Explorer links for deck | Polish | Rehearse demo | Finish deck, rehearse ×2 |
| **17:00+** | 🎤 Final rehearsal + **submit .pptx** | ← | ← | ← |

---

## 5. Go / No-Go Checkpoints

| Time | Checkpoint | If behind → |
|---|---|---|
| **11:00** | `mint_pack` deployed from Playground; tx on Explorer | Debug with Claude; simplify fields |
| **12:30** | All 3 instructions pass in Playground Test tab | Drop `transfer_custody`; demo mint → dispense → clone |
| **13:00** | IDL + Program ID in repo; first frontend call succeeds | Memo-program fallback |
| **15:30** | End-to-end flow works on Vercel URL | Freeze, record backup video |
| **17:00** | .pptx final + rehearsed | Cut slides, not demo |

---

## 6. Sync Rituals (5 min, standing)

| Time | Question |
|---|---|
| **11:30** | Program deployed? Mocks working? |
| **13:00** | IDL shipped? First real transaction from UI? |
| **15:00** | End-to-end on Vercel? What gets cut? |
| **16:30** | Deck + demo locked? Who presents what? |

**Rule:** blocked > 20 min → say so in chat immediately. P1 and P2 pair on integration bugs.

---

## 7. Presentation Split (3 min)

| Segment | Time | Presenter |
|---|---|---|
| Problem — Bangladesh context, stats | 0:40 | P4 |
| Solution + why Solana | 0:40 | P4 |
| **Live demo** — scan genuine → scan clone → 🚫 | 1:00 | P3 drives · P2 narrates |
| Potential, roadmap, ask | 0:30 | P4 |
| Buffer | 0:10 | — |

**P1** fields technical questions from judges.

---

## 8. Key Links

| Resource | Link |
|---|---|
| Solana Playground | https://beta.solpg.io |
| Devnet faucet | https://faucet.solana.com |
| Solana Explorer (set to devnet) | https://explorer.solana.com |
| Solana docs | https://solana.com/docs |
| Anchor docs | https://anchor-lang.com/docs |
| solana.new | https://www.solana.new |
| Submission (.pptx only) | https://tally.so/r/rj7oqN |
| Repo / Vercel URL / Deck link | *fill in at 10:00* |
