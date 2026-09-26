# MedTrace: Technical Design Document

*Author: Engineering Lead · Status: **Approved for build** · Date: Sat 26 Sep 2026*
*Build IRL Vol. 1 · Solana Hackathon · Dogpatch Labs, Dublin*
*Companion docs: `MedTrace_Frontend_Plan.md` (frontend detail) · `docs/MedTrace_Problem_and_Tech.md` (problem context)*

---

## 0. Summary

MedTrace gives every medicine pack a **serial number recorded on Solana**. Each handover (manufacturer → distributor → pharmacy → patient) is a **signed onchain state change**. A patient scans the QR code on the box and gets an instant verdict. Because a pack can be **dispensed only once**, a photocopied clone of its QR code shows **ALREADY DISPENSED**.

| Layer | Technology | Owner |
|---|---|---|
| Onchain program | Anchor (Rust), built and deployed from Solana Playground to **devnet** | P1 |
| App backend | Next.js Route Handlers (server-side reads, REST contract), running on Vercel | P2 |
| Frontend | Next.js 16 App Router, web3.js v1, Anchor TS, wallet-adapter, TanStack Query | P2 (roles), P3 (verify) |
| Infrastructure | Vercel, a Helius devnet RPC, GitHub + Codespaces | P3 |
| Pitch / QA | PowerPoint for the web | P4 |

**Solana primitives used:** a program (Anchor) · a PDA per pack (`["pack", serial]`) · signer + `has_one` authorization · Clock sysvar · events · `confirmed` commitment · memcmp-filtered RPC queries · Explorer as the public audit trail (full detail in **§3A**).

---

## 1. Goals, non-goals, scope

### Goals (hackathon MVP, due 15:30 feature freeze)
1. **G1:** A manufacturer registers a pack onchain with serial, batch and expiry.
2. **G2:** Custody moves manufacturer → distributor → pharmacy. Only the current holder can move it.
3. **G3:** A pharmacy dispenses a pack **exactly once**. A second dispense fails onchain.
4. **G4:** A patient scans a QR code on a phone and sees a verdict in under 3 s, with **no wallet and no app install**.
5. **G5:** A cloned QR code scanned after dispense shows **ALREADY_DISPENSED**.
6. **G6:** Every write shows a clickable **Solana Explorer** link as proof.

### Stretch (only if everything above is green by 13:30)
- **S1:** A manufacturer registry. Only wallets approved by the regulator can mint.
- **S2:** A regulator view listing every pack and its status.

### Non-goals (explicitly out of scope today)
Mainnet, patient identity or PII, payments, GS1/DataMatrix codes, batch minting, compressed accounts, an indexer database, and a gasless relayer. These are all covered in the §14 roadmap.

---

## 2. System context

```
   ┌────────────┐  ┌────────────┐  ┌────────────┐          ┌────────────┐
   │Manufacturer│  │Distributor │  │ Pharmacy   │          │  Patient   │
   │ (Phantom)  │  │ (Phantom)  │  │ (Phantom)  │          │ (phone cam)│
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘          └─────┬──────┘
         │ sign tx       │ sign tx       │ sign tx               │ HTTPS GET /verify/SQ-…
         ▼               ▼               ▼                       ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                 Next.js app on Vercel  (medtrace.vercel.app)          │
   │  ┌──────────────────────────────┐   ┌──────────────────────────────┐ │
   │  │ Browser: role screens         │   │ Server: /verify (RSC),       │ │
   │  │ wallet-adapter + Anchor TS    │   │ /api/packs/* Route Handlers  │ │
   │  │ builds and sends txs directly │   │ read-only Anchor program     │ │
   │  └──────────────┬───────────────┘   └──────────────┬───────────────┘ │
   └─────────────────┼──────────────────────────────────┼─────────────────┘
                     │ sendTransaction                   │ getAccountInfo / getProgramAccounts
                     ▼                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │           Solana devnet RPC  (Helius key on server, public in browser)│
   └──────────────────────────────┬───────────────────────────────────────┘
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │   MedTrace program (Anchor)  ·  Pack PDAs  ·  events  ·  [Config/Mfr] │
   └──────────────────────────────────────────────────────────────────────┘
```

**Trust model:** the chain is the **only source of truth**. The Next.js server is a stateless read proxy: it stores nothing, holds no private keys and signs nothing. Every write is signed in the user's own wallet.

---

## 3. Onchain design (the core backend)

### 3.1 Accounts

**`Pack`**: one PDA per physical pack.

| Offset | Field | Type | Bytes | Notes |
|---|---|---|---|---|
| 0 | *(discriminator)* | — | 8 | Anchor |
| **8** | `manufacturer` | `Pubkey` | 32 | set at mint, never changes |
| **40** | `holder` | `Pubkey` | 32 | current custodian: **memcmp filter offset** |
| **72** | `status` | `PackStatus` enum | 1 | see §3.3: **memcmp filter offset** |
| 73 | `expiry` | `i64` | 8 | unix **seconds** |
| 81 | `dispensed_at` | `i64` | 8 | unix **seconds**; `0` = not dispensed |
| 89 | `created_at` | `i64` | 8 | unix seconds |
| 97 | `bump` | `u8` | 1 | stored PDA bump |
| 98 | `serial` | `String` (max 32) | 4+32 | `SQ-000123`, uppercase, also the PDA seed |
| var | `batch` | `String` (max 16) | 4+16 | `B-2026-09` |
| | **Total** | | **~154 B** | Rent-exempt ≈ **0.00197 SOL per pack** |

> **Decision:** the **fixed-size fields come first and the strings last.** Borsh writes strings at their actual length, so any field *after* a string sits at a variable offset and can't be filtered by RPC. With this order, `holder` is always at byte 40 and `status` at byte 72, so "packs held by wallet X" is a single server-side `getProgramAccounts` memcmp query (§3A.5).

**PDA:** `seeds = [b"pack", serial.as_bytes()]`. The serial is unique by construction: a second mint of the same serial fails because the account already exists.

> **Decision:** `dispensed_at` is a plain `i64` with `0` meaning "none", not `Option<i64>`. That gives a fixed layout, simpler decoding and one fewer thing to handle on the client. The frontend mapper turns `0` into `null`.

**Stretch S1 accounts:**

| Account | Seeds | Fields |
|---|---|---|
| `Config` | `[b"config"]` | `admin: Pubkey` (the regulator), `bump` |
| `Manufacturer` | `[b"mfr", wallet]` | `wallet`, `name: String(32)`, `approved: bool`, `bump` |

### 3.2 Instructions

| Instruction | Args | Accounts (exact IDL names) | Preconditions | Effect |
|---|---|---|---|---|
| `mint_pack` | `serial: String, batch: String, expiry: i64` | `pack` (init, PDA), `manufacturer` (signer, mut, payer), `system_program` | serial 1–32 chars of `A-Z 0-9 -` (uppercase enforced: no look-alike PDAs); batch 1–16 printable chars; `expiry > now` | Creates the Pack, `holder = manufacturer`, `status = Manufactured`, emits `PackMinted` |
| `transfer_custody` | `new_holder: Pubkey` | `pack` (mut), `holder` (signer) | `pack.holder == holder`; `new_holder != holder`; status allows it (§3.3) | `holder = new_holder`, status advances, emits `CustodyTransferred` |
| `dispense` | — | `pack` (mut), `holder` (signer) | `pack.holder == holder`; `status == AtPharmacy` | `status = Dispensed`, `dispensed_at = now`, emits `PackDispensed` |
| *S1* `init_config` | — | `config` (init), `admin` (signer) | once only | sets the admin |
| *S1* `approve_manufacturer` | `name: String` | `config`, `manufacturer_record` (init), `wallet` (unchecked), `admin` (signer) | `admin == config.admin` | approves the manufacturer |

> **Frontend note:** these account names are final and replace the placeholders in the Frontend Plan §5.4. `mintPack` takes `{ pack, manufacturer }` and `transferCustody` / `dispense` take `{ pack, holder }`. Anchor TS names are camelCase.

### 3.3 State machine

```
  mint_pack            transfer_custody           transfer_custody            dispense
 ─────────▶ Manufactured ───────────────▶ InTransit ───────────────▶ AtPharmacy ─────────▶ Dispensed
            (holder=mfr)     (→ distributor)          (→ pharmacy)               (terminal)
```

| From | Instruction | To | Otherwise |
|---|---|---|---|
| — | `mint_pack` | Manufactured | `SerialTaken` if the account exists (system error) |
| Manufactured | `transfer_custody` | InTransit | — |
| InTransit | `transfer_custody` | AtPharmacy | — |
| AtPharmacy | `transfer_custody` | ✗ | `InvalidStatus` |
| AtPharmacy | `dispense` | Dispensed | — |
| Dispensed | anything | ✗ | `AlreadyDispensed` |
| Manufactured / InTransit | `dispense` | ✗ | `NotAtPharmacy` |

> **Decision (ADR-3):** the **status follows the hop count**. The 1st transfer sets InTransit and the 2nd sets AtPharmacy. This keeps the agreed signature `transfer_custody(new_holder)`, with no role registry needed for the MVP. **Limitation:** exactly one distributor hop. Post-MVP, an `Actor` role registry will set the status from the recipient's role.

### 3.4 Errors

| Code | Name | Message |
|---|---|---|
| 6000 | `InvalidSerial` | Serial must be 1–32 bytes |
| 6001 | `InvalidBatch` | Batch must be ≤ 16 bytes |
| 6002 | `AlreadyExpired` | Expiry must be in the future |
| 6003 | `NotHolder` | Signer is not the current holder |
| 6004 | `SameHolder` | New holder equals current holder |
| 6005 | `InvalidStatus` | Transfer not allowed in current status |
| 6006 | `NotAtPharmacy` | Pack must be at a pharmacy to dispense |
| 6007 | `AlreadyDispensed` | Pack has already been dispensed |
| 6008 | `ManufacturerNotApproved` | *(S1)* Wallet is not an approved manufacturer |

The frontend `errors.ts` maps these **names** (not the numbers) to plain-English messages.

### 3.5 Events (for indexers and future analytics)

```rust
#[event] pub struct PackMinted        { pub serial: String, pub manufacturer: Pubkey, pub batch: String, pub expiry: i64, pub ts: i64 }
#[event] pub struct CustodyTransferred { pub serial: String, pub from: Pubkey, pub to: Pubkey, pub status: PackStatus, pub ts: i64 }
#[event] pub struct PackDispensed     { pub serial: String, pub pharmacy: Pubkey, pub ts: i64 }
```

These cost almost nothing today, and they make the §7 indexer a drop-in later: it parses events instead of diffing accounts.

### 3.6 Program skeleton (paste into Solana Playground)

```rust
use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111"); // Playground fills this on build

#[program]
pub mod medtrace {
    use super::*;

    pub fn mint_pack(ctx: Context<MintPack>, serial: String, batch: String, expiry: i64) -> Result<()> {
        require!(!serial.is_empty() && serial.len() <= 32, MedError::InvalidSerial);
        require!(batch.len() <= 16, MedError::InvalidBatch);
        let now = Clock::get()?.unix_timestamp;
        require!(expiry > now, MedError::AlreadyExpired);

        let pack = &mut ctx.accounts.pack;
        let mfr = ctx.accounts.manufacturer.key();
        pack.serial = serial.clone();
        pack.batch = batch.clone();
        pack.expiry = expiry;
        pack.manufacturer = mfr;
        pack.holder = mfr;
        pack.status = PackStatus::Manufactured;
        pack.dispensed_at = 0;
        pack.created_at = now;
        pack.bump = ctx.bumps.pack;

        emit!(PackMinted { serial, manufacturer: mfr, batch, expiry, ts: now });
        Ok(())
    }

    pub fn transfer_custody(ctx: Context<TransferCustody>, new_holder: Pubkey) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require_keys_neq!(new_holder, pack.holder, MedError::SameHolder);
        pack.status = match pack.status {
            PackStatus::Manufactured => PackStatus::InTransit,
            PackStatus::InTransit    => PackStatus::AtPharmacy,
            PackStatus::Dispensed    => return err!(MedError::AlreadyDispensed),
            PackStatus::AtPharmacy   => return err!(MedError::InvalidStatus),
        };
        let from = pack.holder;
        pack.holder = new_holder;
        emit!(CustodyTransferred {
            serial: pack.serial.clone(), from, to: new_holder,
            status: pack.status, ts: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn dispense(ctx: Context<Dispense>) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require!(pack.status != PackStatus::Dispensed, MedError::AlreadyDispensed);
        require!(pack.status == PackStatus::AtPharmacy, MedError::NotAtPharmacy);
        let now = Clock::get()?.unix_timestamp;
        pack.status = PackStatus::Dispensed;
        pack.dispensed_at = now;
        emit!(PackDispensed { serial: pack.serial.clone(), pharmacy: pack.holder, ts: now });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(serial: String)]
pub struct MintPack<'info> {
    #[account(
        init, payer = manufacturer, space = 8 + Pack::INIT_SPACE,
        seeds = [b"pack", serial.as_bytes()], bump
    )]
    pub pack: Account<'info, Pack>,
    #[account(mut)]
    pub manufacturer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferCustody<'info> {
    #[account(mut, has_one = holder @ MedError::NotHolder)]
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

#[derive(Accounts)]
pub struct Dispense<'info> {
    #[account(mut, has_one = holder @ MedError::NotHolder)]
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Pack {
    // fixed-size fields FIRST → stable offsets for RPC memcmp filters (§3A.5)
    pub manufacturer: Pubkey,   // offset 8
    pub holder: Pubkey,         // offset 40
    pub status: PackStatus,     // offset 72
    pub expiry: i64,
    pub dispensed_at: i64,
    pub created_at: i64,
    pub bump: u8,
    // variable-length fields LAST
    #[max_len(32)] pub serial: String,
    #[max_len(16)] pub batch: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PackStatus { Manufactured, InTransit, AtPharmacy, Dispensed }

#[event] pub struct PackMinted { pub serial: String, pub manufacturer: Pubkey, pub batch: String, pub expiry: i64, pub ts: i64 }
#[event] pub struct CustodyTransferred { pub serial: String, pub from: Pubkey, pub to: Pubkey, pub status: PackStatus, pub ts: i64 }
#[event] pub struct PackDispensed { pub serial: String, pub pharmacy: Pubkey, pub ts: i64 }

#[error_code]
pub enum MedError {
    #[msg("Serial must be 1–32 bytes")] InvalidSerial,
    #[msg("Batch must be ≤ 16 bytes")] InvalidBatch,
    #[msg("Expiry must be in the future")] AlreadyExpired,
    #[msg("Signer is not the current holder")] NotHolder,
    #[msg("New holder equals current holder")] SameHolder,
    #[msg("Transfer not allowed in current status")] InvalidStatus,
    #[msg("Pack must be at a pharmacy to dispense")] NotAtPharmacy,
    #[msg("Pack has already been dispensed")] AlreadyDispensed,
}
```

> **Anchor version note:** `ctx.bumps.pack` (a bumps struct) needs Anchor ≥ 0.29. If Playground errors, use `*ctx.bumps.get("pack").unwrap()`. `#[derive(InitSpace)]` needs ≥ 0.28. `SerialTaken` isn't a custom error: a second `init` fails with a system "account already in use" error, and the frontend maps that to "Serial already exists".

**S1 add-on (only after 13:30):** add `Config` + `Manufacturer` accounts, and to `MintPack` add
`#[account(seeds=[b"mfr", manufacturer.key().as_ref()], bump, constraint = mfr_record.approved @ MedError::ManufacturerNotApproved)] pub mfr_record: Account<'info, ManufacturerRecord>`.
Adding this changes the IDL, so **P2 must re-pull it**. Announce it in chat first.

---

## 3A. Solana platform design

This section covers how MedTrace uses Solana itself: accounts, transactions, fees, RPC, wallets and the path to mainnet. P1 owns it, P2 consumes it, and P4 turns §3A.1 into the "Why Solana" slide.

### 3A.1 Why Solana (and not a database or another chain)

| Need | Private database | Solana |
|---|---|---|
| Can the patient trust the answer? | Only if they trust whoever runs the DB | Public state; anyone can check it on **Explorer** without asking us |
| Can a bad actor rewrite history? | An admin can edit or delete rows | Changes are signed transactions; history is permanent |
| Who can move a pack? | App logic we write and must secure | Enforced by the **program** (`has_one = holder` + signature) |
| Multi-party (manufacturer, distributor, pharmacy, regulator) | Needs shared hosting, APIs and trust agreements | One shared ledger; each party only needs a wallet |
| Cost per pack | Cheap | **~0.002 SOL rent + 5,000 lamports fee** (≈ 0.000005 SOL/signature); low enough for per-pack tracking |
| Speed at the counter | Fast | Fast confirmations (`confirmed` commitment); the patient read is a single account fetch |

**Why Solana over other chains:** the per-transaction fees are low enough for **one write per physical pack per handover**. PDAs give an O(1) lookup straight from the serial on the box. And the tooling (Anchor, Playground, Phantom, Explorer) lets a 4-person team ship in one day.

> **Pitch line (P4):** "A database asks patients to trust us. Solana lets them check for themselves, and makes a used code impossible to reuse."

### 3A.2 Solana concepts → MedTrace mapping

| Solana concept | What it is | In MedTrace |
|---|---|---|
| **Program** | Stateless onchain code (Rust / Anchor) | `medtrace`: 3 instructions (§3.2) |
| **Account** | Where state lives; owned by a program | One `Pack` account per physical pack |
| **PDA** (Program Derived Address) | An address derived from seeds + program ID, with no private key | `["pack", serial]`, so the QR code only needs the serial |
| **Rent-exempt deposit** | Lamports locked so an account persists | ≈ 0.00197 SOL per Pack, paid by the manufacturer |
| **Transaction / signature** | Signed bundle of instructions; the signature is its ID | Every mint, transfer and dispense; the signature becomes the Explorer link |
| **Signer + `has_one`** | Onchain authorization | Only the current `holder` can transfer or dispense |
| **Fee payer** | The wallet paying the base fee | The signing role wallet (relayer later, §7) |
| **Clock sysvar** | Onchain timestamp | `dispensed_at`, `created_at`, expiry check |
| **Events / logs** | `emit!` data in the transaction logs | `PackMinted`, `CustodyTransferred`, `PackDispensed` for the indexer |
| **IDL** | JSON description of the program interface | `app/src/idl/medtrace.json`, which generates the typed TS client |
| **Cluster** | devnet / testnet / mainnet-beta | **devnet** today |
| **Commitment** | processed → confirmed → finalized | `confirmed` for UI + reads (§3A.4) |

### 3A.3 Transaction anatomy (example: `dispense`)

```
Transaction
├── signatures:        [pharmacy_wallet_sig]                 ← fee payer + holder
├── recent_blockhash:  <fetched just before sending>         ← valid for ~150 blocks (~1 min)
└── instructions[0]:   medtrace::dispense
      ├── program_id:  <MedTrace program ID>
      ├── data:        sha256("global:dispense")[0..8]       ← Anchor discriminator, no args
      └── accounts:
            pack    (writable)          = PDA("pack", "SQ-000123")
            holder  (signer)            = pharmacy wallet
```

| Instruction | Signers | Writable accounts | Approx. size |
|---|---|---|---|
| `mint_pack` | manufacturer | pack (new), manufacturer (pays rent) | well under the 1,232-byte tx limit |
| `transfer_custody` | holder | pack | small (32-byte pubkey arg) |
| `dispense` | holder | pack | smallest |

Compute use is expected to be far below the 200k-CU default per instruction. Check the "consumed X compute units" line in the Playground logs; no compute-budget instruction is needed on devnet.

### 3A.4 Commitment, confirmation & retries

| Operation | Commitment | Why |
|---|---|---|
| UI writes (`.rpc()`) | `confirmed` | Supermajority-voted; fast enough for a live demo |
| `/verify` reads | `confirmed` | So a patient scanning seconds after dispense sees `Dispensed` |
| Audit / regulator export (future) | `finalized` | Maximum certainty |

- **Blockhash expiry:** if a wallet popup is left open for more than about a minute, the transaction fails with "Blockhash not found". The UI shows "Took too long, try again" and **rebuilds the transaction** (new blockhash) on retry. It never re-sends the old one.
- **Duplicate click:** "This transaction has already been processed" is mapped to success-pending and the pack is re-fetched.
- **Priority fees:** not needed on devnet. On mainnet, add a `ComputeBudgetProgram.setComputeUnitPrice` instruction sized from `getRecentPrioritizationFees`.

### 3A.5 RPC usage

| Need | RPC method | Call |
|---|---|---|
| Verify one pack | `getAccountInfo` | `program.account.pack.fetchNullable(packPda(serial))` |
| Packs held by a wallet | `getProgramAccounts` + **memcmp** | `program.account.pack.all([{ memcmp: { offset: 40, bytes: holder.toBase58() } }])` |
| Packs by status | `getProgramAccounts` + **memcmp** | `offset: 72`, `bytes: bs58([statusIndex])`: `"1"`=Manufactured, `"2"`=InTransit, `"3"`=AtPharmacy, `"4"`=Dispensed |
| Wallet SOL balance | `getBalance` | RoleHeader low-balance banner |
| Health | `getSlot` | `/api/health` |
| Tx history (future) | `getSignaturesForAddress(pack)` | Pack timeline, straight from chain |

- **Server:** a Helius devnet key (`RPC_URL`, secret). **Browser:** the public devnet endpoint, used only for sending wallet transactions and a few reads.
- `getProgramAccounts` is fine for demo scale (tens of packs). At pilot scale, replace it with the §7 indexer.

### 3A.6 Wallets & keys

| Wallet | Where | Role | Funding |
|---|---|---|---|
| Playground wallet | Solana Playground (browser storage) | **Program upgrade authority** + deployer | ≥ 3 devnet SOL (deploy needs rent for the program) |
| Manufacturer | Phantom account #1 (demo laptop) | mints, pays rent | ≥ 1 devnet SOL |
| Distributor | Phantom account #2 | transfers | ≥ 0.2 devnet SOL |
| Pharmacy | Phantom account #3 | transfers, dispenses | ≥ 0.2 devnet SOL |
| *S1* Regulator | Phantom account #4 or the Playground wallet | `Config.admin` | ≥ 0.2 devnet SOL |

- Set Phantom to **Devnet** (Settings → Developer settings / testnet mode). Mainnet mode shows a zero balance and failed transactions.
- Get devnet SOL from `faucet.solana.com` or `solana airdrop` in Playground. The faucet has rate limits, so **fund everything before 11:00**.
- **Export the Playground wallet keypair** and keep it offline with P1. Losing it means losing upgrade authority, and you'd have to redeploy under a new program ID.
- Only public keys go in the repo (`lib/medtrace/config.ts`). Seed phrases and keypairs never do.

### 3A.7 Explorer & verifiability

- Transaction: `https://explorer.solana.com/tx/<sig>?cluster=devnet`
- Pack account: `https://explorer.solana.com/address/<packPda>?cluster=devnet` (shows the full custody transaction history)
- Program: `https://explorer.solana.com/address/<programId>?cluster=devnet`
- Anchor IDLs uploaded with the program let Explorer **decode** Pack data and instruction arguments. Publish the IDL from Playground after deploy so judges see readable fields, not raw bytes.

### 3A.8 Devnet realities (demo risks)

| Risk | Mitigation |
|---|---|
| Devnet congestion or slow confirmations | Helius RPC; `confirmed` commitment; backup video |
| Faucet rate-limited | Fund all wallets in the morning; keep 2 SOL spare in the Playground wallet |
| Devnet reset (rare) wipes the program and accounts | Keep `program/lib.rs` in the repo; the redeploy + re-mint script takes < 10 min |
| Program redeploy with a changed layout breaks old Packs | Layout frozen after 13:00 (§10); mint fresh demo serials after any upgrade |

### 3A.9 Cost model

| Item | Per pack | 1,000 packs | 1,000,000 packs |
|---|---|---|---|
| Rent (Pack account, locked) | ≈ 0.00197 SOL | ≈ 1.97 SOL | ≈ 1,970 SOL |
| Tx fees (mint + 2 transfers + dispense = 4 sigs × 5,000 lamports) | 0.00002 SOL | 0.02 SOL | 20 SOL |

- **Takeaway:** fees are negligible; **rent dominates at national scale**. That is why the roadmap moves to **state compression / ZK compression**, which cuts per-pack storage cost by orders of magnitude. The data model stays the same, so only the program and indexer change.
- **Don't close dispensed Packs to reclaim rent.** Closing makes a clone read **UNKNOWN** instead of ALREADY_DISPENSED, which weakens the anti-counterfeit signal. Archive them through compression instead.

### 3A.10 Path to mainnet

1. **Upgrade authority:** move from the Playground wallet to a **multisig** (for example Squads). Consider making the program immutable once stable.
2. **Verified build:** publish a reproducible build so anyone can check that the deployed bytecode matches the public source.
3. **Security audit** of the program (authorization, PDA seeds, state transitions).
4. **Registry live** (S1): the regulator (e.g., DGDA) holds `Config.admin` through a multisig.
5. **Priority fees + reliable RPC** (paid tier, with a failover endpoint).
6. **Relayer / fee payer** so pharmacies never need SOL (§7).
7. **Compression** for scale (§3A.9).

### 3A.11 Solana tooling used

| Tool | Use |
|---|---|
| [Solana Playground](https://beta.solpg.io) | Write, build, test and deploy the Anchor program; export the IDL |
| [Anchor](https://www.anchor-lang.com/docs) | Program framework, IDL, TS client |
| [Phantom](https://phantom.com) | Role wallets (devnet) |
| [Solana Explorer](https://explorer.solana.com/?cluster=devnet) | Proof links in the UI and deck |
| [Devnet faucet](https://faucet.solana.com) | Funding wallets |
| Helius (devnet RPC) | Reliable server-side reads |
| [Solana docs](https://solana.com/docs) | Accounts, PDAs, transactions, RPC reference |

---

## 4. App backend (Next.js server)

### 4.1 Responsibilities
1. **Server-side reads** for `/verify`. It uses the private Helius RPC key, so patient phones never touch RPC.
2. **REST API**: the stable contract future backends must honour.
3. **The verdict engine**: `computeVerdict()`, a pure function in one place.
4. **Out of scope today:** no DB, no signing, no user sessions.

### 4.2 REST API contract (v1)

| Method | Path | Query | 200 response | Errors |
|---|---|---|---|---|
| GET | `/api/packs` | `holder?`, `status?` | `Pack[]` | `400 BAD_QUERY` |
| GET | `/api/packs/:serial` | — | `Pack` | `404 NOT_FOUND`, `400 INVALID_SERIAL` |
| GET | `/api/packs/:serial/verdict` | `pharmacy?` | `VerdictResult` | `400 INVALID_SERIAL`; `503 RPC_UNAVAILABLE` (never "fake" when the network is down) |
| GET | `/api/health` | — | `{ ok, programId, cluster, slot }` | `503` |

- All responses carry `Cache-Control: no-store`, and errors have the shape `{ error: { code, message } }`.
- Serials are normalised with `trim().toUpperCase()` and must match `^[A-Z0-9-]{1,32}$`.
- DTOs contain **no BN or PublicKey objects**, only strings and numbers (see the Frontend Plan §4.1).

### 4.3 Verdict engine (the business rules)

```
UNKNOWN            ← no Pack account for serial
GENUINE            ← status = Dispensed AND now − dispensed_at ≤ 600 s     ("dispensed to you just now")
ALREADY_DISPENSED  ← status = Dispensed AND now − dispensed_at > 600 s     ("code already used — possible clone")
OTHER_PHARMACY     ← ?pharmacy given AND holder ≠ pharmacy                 (pre-dispense check at a counter)
GENUINE            ← otherwise (InTransit / AtPharmacy / Manufactured)
+ EXPIRED flag     ← expiry < now (shown as a warning on top of any verdict)
```

`FRESH_DISPENSE_SECONDS = 600` is a single constant. Every rule is unit-tested (Frontend Plan §9).

### 4.4 Failure handling
- RPC timeout (5 s) → retry once, then return **503**. The UI then says "Network busy, retry"; **it never says fake**.
- A missing IDL or program ID at boot → `/api/health` fails, so the problem shows up **before** the demo.

---

## 5. Frontend (summary; detail in `MedTrace_Frontend_Plan.md`)

| Route | Render | Wallet | Owner | Purpose |
|---|---|---|---|---|
| `/manufacturer` | Client | ✔ | P2 | Mint → PackCard + QR + Explorer |
| `/distributor` | Client | ✔ | P2 | Lookup → transfer to a named wallet |
| `/pharmacy` | Client | ✔ | P2 | Stock list → dispense |
| `/verify/[serial]` | **Server** | ✘ | P3 | Patient verdict (English) |
| `/qr` | Client | ✘ | P3 | Printable QR sheet |
| `/regulator` | Client | ✘ | P3 (S2) | All packs + statuses |

**Data layer:** `MedTraceClient` with `mock`, `onchain` and `http` implementations, selected by `NEXT_PUBLIC_DATA_SOURCE`. The UI never imports Anchor. Only `mapper.ts` handles BN and PublicKey.

---

## 6. Key flows (sequence)

### 6.1 Mint
```
Manufacturer UI      Phantom         RPC/Program
     │ build mintPack(serial,batch,expiry) + pack PDA
     │──────────────▶│ sign
     │               │──────────────▶│ init Pack (status=Manufactured, holder=mfr)
     │◀──────────────────────────────│ sig (confirmed)
     │ show PackCard + QR(https://app/verify/SQ-…) + Explorer link
```

### 6.2 Transfer and dispense
```
Distributor/Pharmacy UI → Phantom sign → Program checks has_one=holder + status → state++ → sig → UI invalidates ["pack",serial] → stepper advances
```

### 6.3 Patient verify (and clone detection)
```
Phone camera ─GET /verify/SQ-000123──▶ Next.js server (RSC)
                                         │ packPda(serial) → getAccountInfo (Helius)
                                         │ computeVerdict(pack, now)
Phone ◀────────────── HTML verdict card ─┘   (~300–800 ms, no JS wallet bundle)

Genuine box, scanned right after dispense → Dispensed, age 40 s  → ✅ GENUINE
Clone box (same QR), scanned later        → Dispensed, age > 10m → 🚫 ALREADY_DISPENSED
Random QR SQ-999999                       → no account           → 🚫 UNKNOWN
```

---

## 7. Target backend architecture (post-hackathon)

This is designed now so that nothing built today has to be thrown away.

```
Program events ──▶ Helius webhook ──▶ /api/ingest (verify signature) ──▶ Postgres
                                                                        │
            /api/packs/* (same REST contract) ◀─────────────────────────┘
            /api/tx/*  ──▶ Relayer (fee payer) ──▶ Program     (gasless for pharmacies)
            Auth: Sign-In-With-Solana for role actors; verify stays public
```

**Data model (Postgres):**

| Table | Key columns |
|---|---|
| `packs` | `serial PK`, `pda`, `batch`, `expiry`, `manufacturer`, `holder`, `status`, `dispensed_at`, `updated_slot` |
| `events` | `id`, `serial FK`, `type`, `from`, `to`, `slot`, `signature UNIQUE`, `ts` |
| `actors` | `wallet PK`, `role` (manufacturer / distributor / pharmacy / regulator), `name`, `licence_no`, `approved` |
| `scans` | `id`, `serial`, `verdict`, `ts`, `coarse_geo` (**no PII**), used for counterfeit hotspot analytics |

Swapping in this backend means changing the route handler bodies and setting `NEXT_PUBLIC_DATA_SOURCE=http`. **No UI changes.**

---

## 8. Security & threat model

| # | Threat | MVP mitigation | Residual risk / future fix |
|---|---|---|---|
| T1 | **Photocopied QR after sale** | Single dispense + 10-min window → ALREADY_DISPENSED | — (this is the core demo) |
| T2 | **Clone scanned *before* the genuine pack is sold** | The clone shows GENUINE, so we **can't** catch it at scan time | Scratch-off PIN per pack (hash stored onchain, revealed at dispense); pharmacy scans at the counter with `?pharmacy=` → OTHER_PHARMACY |
| T3 | Counterfeiter mints their own "genuine" packs | UI shows the manufacturer address | **S1 registry**: only regulator-approved wallets can mint; the UI shows the registered name |
| T4 | Non-holder moves or dispenses a pack | `has_one = holder` + `Signer` check onchain | — |
| T5 | Serial squatting (mint someone else's serial first) | Serials come only from the manufacturer UI | S1 registry + manufacturer-prefixed seeds `[b"pack", mfr, serial]` |
| T6 | Colluding pharmacy dispenses then resells | Dispense is public and auditable | Regulator dashboard anomaly alerts |
| T7 | Leaked RPC key | Key is server-only (`RPC_URL`), rate-limited | Rotate the key; domain-restrict it on Helius |
| T8 | Patient privacy | **No PII onchain or in logs** | Keep only coarse scan analytics |
| T9 | Phishing QR pointing to a look-alike domain | One canonical domain printed on the box | Signed QR payloads verified by the app |

**Rule:** the verify page **never** shows "fake" because of a network error. RPC failure → 503 → "Network busy, retry".

---

## 9. Non-functional requirements

| Area | Target | How |
|---|---|---|
| Verify latency | p50 < 1 s, p95 < 3 s on 4G | Server Component, one `getAccountInfo`, no wallet bundle |
| Write confirmation | < 5 s (`confirmed`) | devnet; spinner states |
| Cost | ~0.002 SOL rent + ~0.000005 SOL fee per pack | Fund each demo wallet with ≥ 1 devnet SOL |
| Availability (demo) | 100% for 3 min | Helius RPC, backup video, pre-minted spares |
| Accessibility | Readable at arm's length; meaning never shown by colour alone | ≥ 32 px verdict, icon + text, 44 px tap targets |
| Scale (future) | Millions of packs | Compressed accounts / state compression; indexer instead of `getProgramAccounts` |

---

## 10. Environments, config & deployment

| Env | Program | App | RPC |
|---|---|---|---|
| **local/Codespace** | devnet program | `npm run dev` (use `DATA_SOURCE=mock` until 13:00) | public devnet |
| **preview** | devnet | Vercel preview per branch | Helius (server) |
| **prod-demo** | devnet | Vercel `main` → `medtrace.vercel.app` | Helius (server) |

**Deploy pipeline:**
1. **Program:** P1 builds in Playground → deploys to devnet → posts the program ID → **commits** `program/lib.rs` + `app/src/idl/medtrace.json` (+ `medtrace.ts` types) in the same PR.
2. **App:** a PR runs `npm run test && npm run build` (locally, or an optional GitHub Action) → merge → Vercel deploys automatically.
3. **Env vars** (Vercel): `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_RPC_URL`, `RPC_URL` (secret), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLUSTER`, `NEXT_PUBLIC_PROGRAM_ID` (legacy IDL only). **Redeploy after changing any `NEXT_PUBLIC_` value.**

**Program upgrades:** keep the **same program ID** (Playground upgrade). If the account layout changes, old Pack accounts won't decode. Mint fresh demo packs and **never change the layout after 13:00**.

---

## 11. Testing strategy

| Level | What | Tool | Owner | When |
|---|---|---|---|---|
| Program: happy path | mint → transfer → transfer → dispense | Playground Test tab / `client.ts` | P1 | by 12:30 |
| Program: negative | double dispense → `AlreadyDispensed`; non-holder → `NotHolder`; dispense at InTransit → `NotAtPharmacy`; duplicate serial → fails; 33-byte serial → `InvalidSerial` | Playground tests | P1 | by 12:30 |
| Unit | `computeVerdict` (8 cases), mapper (enum, BN, ms guard) | Vitest | P3 / P2 | by 12:00 |
| Integration | `scripts/smoke.ts` reads a real pack; `/api/health` is green | tsx / curl | P2 | 13:30 |
| E2E (manual) | Full demo script on the **Vercel URL on a real phone over 4G** | P4 checklist | P4 | 13:30, 15:00, 16:30 |
| Demo resilience | Airplane-mode test (error state), low-SOL banner, wallet-switch banner | manual | P4 | 15:30 |

**P4 QA checklist:** each step shows an Explorer link · stepper advances · verdict is correct for all 4 serials · works in portrait on 2 phones · the double dispense shows a friendly error.

---

## 12. Architecture decision records (ADRs)

| # | Decision | Alternatives | Why |
|---|---|---|---|
| ADR-1 | **One PDA per pack**, keyed by serial | SPL token/NFT per pack; compressed NFTs | Simplest custom state (status, dispensed_at); O(1) lookup from the QR; no token plumbing. Compression is on the roadmap for scale |
| ADR-2 | **Anchor in Solana Playground** | Local Anchor CLI | No toolchain install in Codespaces; one owner deploys |
| ADR-3 | **Status set by hop count** | Role registry; explicit status arg | Keeps the agreed signature; fewer accounts; the limitation is documented |
| ADR-4 | **Dispense-once + 10-min freshness window** for verdicts | Scan counter onchain; patient PIN | No patient write or wallet needed; demonstrates clone detection clearly |
| ADR-5 | **Stateless Next.js server as read proxy** | Separate Express/Nest backend; DB now | Zero extra infra today; REST contract keeps the path to an indexer open |
| ADR-6 | **web3.js v1 + Anchor TS** | `@solana/kit` + Codama | Anchor TS supports only v1; reliability matters more than novelty on hackathon day |
| ADR-7 | **Server-rendered verify page** | Client-side fetch | Fast on low-end phones; no RPC key or wallet code shipped |
| ADR-8 | `dispensed_at: i64` with `0` = none | `Option<i64>` | Fixed layout; simpler decoding |

---

## 13. Work breakdown & milestones

| Milestone | Time | Owner(s) | Exit criteria |
|---|---|---|---|
| **M0 Contract freeze** | 10:45 | All | §3.1–3.4 + REST §4.2 + DTO types pinned in chat; mock merged |
| **M1 Mint live** | 11:00 | P1 | `mint_pack` on devnet, Explorer tx posted |
| **M2 Program complete** | 12:30 | P1 | All positive and negative tests pass |
| **M3 IDL shipped** | 13:00 | P1 → P2 | IDL + program ID in the repo; `onchain.ts` reads a real pack |
| **M4 First UI tx** | 13:30 | P2 | Mint from the Vercel preview confirms |
| **M5 End-to-end** | 15:00 | P2 + P3 | mint → transfer ×2 → dispense → verify → clone 🚫 on the Vercel URL |
| **M6 Freeze** | 15:30 | All | Backup video recorded; only bug fixes after this |
| **M7 Submit** | 17:00+ | P4 | .pptx submitted; 2 timed rehearsals |

**Critical path:** M0 → M1 → M2 → **M3** → M4 → M5. M3 is the riskiest handoff, so P1 and P2 pair on it from 12:45.

**Fallback ladder** (if the critical path slips):
1. Drop `transfer_custody` from the demo: mint → dispense → clone.
2. Demo reads from chain, but writes are shown from Playground with Explorer links.
3. Last resort: UI on the mock + backup video + Explorer links from Playground.

---

## 14. Roadmap (for the "Potential" slide)

| Phase | Items |
|---|---|
| **Pilot (0–3 mo)** | Manufacturer + pharmacy registry (DGDA as admin), indexer + Postgres, gasless relayer, SIWS auth, Android pharmacy app |
| **Scale (3–12 mo)** | State compression for millions of packs, GS1 DataMatrix serials, batch minting, scratch-off PIN (fixes T2), SMS verify for feature phones |
| **Ecosystem** | Regulator analytics (counterfeit hotspots from scan data), recalls by batch, cross-border export verification |

---

## 15. Open questions (owner → answer by 10:45)

| # | Question | Owner | Default if no answer |
|---|---|---|---|
| Q1 | Does Playground export a new-format or legacy IDL? | P1 | Check at first build; the Frontend Plan §1 table decides the Anchor TS version |
| Q2 | Is 10 min the right freshness window for the demo? | P3 + P4 | 600 s |
| Q3 | S1 registry today, or roadmap only? | P1 | Roadmap unless M2 lands by 12:30 |
| Q4 | Final Vercel domain (it gets printed on the QR codes)? | P3 | `medtrace.vercel.app` or the first free variant |

---

*Changes to §3 (program) or §4.2 (REST) after M0 need a message in the team chat and a thumbs-up from P1 **and** P2.*
