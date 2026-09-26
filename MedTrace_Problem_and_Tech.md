# MedTrace — Problem Statement & Underlying Tech

*Build IRL Vol. 1 · Solana Hackathon · Dogpatch Labs, Dublin · 26 Sep 2026*

---

## Part 1 — Problem Statement

### One-line problem statement
**Patients and pharmacists in Bangladesh cannot tell whether a medicine is genuine at the point of sale, and no single party has a trusted, end-to-end view of where a pack has been.**

### 1.1 The problem in numbers

| Layer | Evidence |
|---|---|
| Global (LMICs) | At least 1 in 10 medicines in low- and middle-income countries is substandard or falsified; ~US$30.5B/year spent on them (WHO) |
| Human cost | WHO estimates >1 million deaths/year globally linked to substandard & falsified medicines |
| Bangladesh scale | Estimated ~৳2,500 crore of fake medicine circulating in the open market at any time |
| What's faked | Antibiotics, syrups, heart / diabetes / cancer drugs — made with flour, chalk, starch; ~500,000 fake antibiotic tablets seized in one operation |
| Oversight gap | 250,000+ medicine shops (many unauthorised); DGDA says full-market monitoring is impossible with current resources |
| Economic stake | Bangladesh exports medicines to ~150 countries — counterfeiting threatens export reputation |

### 1.2 Stakeholders

| Stakeholder | Pain today | What they need |
|---|---|---|
| Patient / caregiver | Can't distinguish fake from genuine; treatment silently fails | A 5-second "is this real?" check |
| Pharmacist | Buys from wholesalers blind; reputational & legal risk | Proof that incoming stock is genuine |
| Manufacturer | Brand damage, revenue loss, export risk | Visibility of where packs actually surface |
| Regulator (DGDA) | Can't inspect 250k+ shops | Data on where fakes appear (hotspots) |
| Distributor | Hard to prove clean handling | Verifiable chain-of-custody record |

### 1.3 Root causes
- **Fragmented supply chain:** manufacturer → distributor → wholesale hubs (e.g. Mitford) → 250k+ pharmacies, with no shared record across hops
- **Price incentive:** counterfeit / substandard stock can roughly double trader profit
- **Low detection:** falsified packs can be visually near-identical to genuine ones
- **Enforcement doesn't scale:** raids are episodic; the market re-forms

### 1.4 Why existing fixes fall short

| Current approach | Weakness |
|---|---|
| Static QR code on the box | **Clonable** — one genuine QR photocopied onto 10,000 fakes still scans "genuine" |
| Each manufacturer's own verification app | 229+ manufacturers = 229 silos; manufacturer is sole judge of its own data |
| Raids & lab testing | Reactive, expensive, doesn't reach remote areas |

### 1.5 Core insight
> **A static code proves a code exists. It doesn't prove *this* pack is the only one carrying it.**

MedTrace gives every pack a unique serial with a **shared, public lifecycle**:
1. **Minted** by the manufacturer (batch, expiry, serial)
2. **Handed off** at each custody step (distributor → pharmacy)
3. **Dispensed** at sale — serial is marked consumed

Clone detection follows naturally: a serial that's already dispensed, held by a different pharmacy, or never registered is flagged.

### 1.6 Why blockchain, not a database?
A single manufacturer *could* build anti-clone logic on a normal database. Solana earns its place because the problem is **multi-party and low-trust**:
- **No single owner of truth** — manufacturers, distributors, pharmacies and DGDA write to one neutral record (dishonest manufacturers are part of the problem)
- **One verification layer for all manufacturers** instead of 229 apps or a DGDA-hosted central system
- **Tamper-evident audit trail** for recalls and prosecutions
- **Low per-event cost** makes per-pack tracking economically viable

### 1.7 Out of scope (state upfront)
- Substandard drugs from a registered manufacturer (genuine pack, bad quality → still needs lab testing)
- Unserialized stock already in the market
- Adoption (manufacturers must serialize, pharmacies must scan) — a business challenge, not a tech one

### 1.8 Regulatory fit
Bangladesh Bank restricts crypto trading; the 2026 National Blockchain Policy requires Bangladesh Bank authorization for payment-related blockchain apps. **MedTrace is a non-payment use** (records & verification) — the lower-risk lane.

---

## Part 2 — Underlying Tech

### 2.1 Architecture

```
 FACTORY               DISTRIBUTOR            PHARMACY              PATIENT
 (wallet)              (wallet)               (wallet)              (no wallet)
    │ mint_pack           │ transfer_custody     │ dispense             │ scan QR
    ▼                     ▼                      ▼                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │   Web app (Next.js)  ── RPC ──►  Solana devnet                           │
 │                                  ├─ MedTrace program (rules)             │
 │                                  └─ Pack accounts (1 per box)            │
 └─────────────────────────────────────────────────────────────────────────┘
   WRITES = signed transactions (tiny fee)     READS = free, no wallet
```

**Mental model:** Solana is a shared backend. The **program** is the business logic, **accounts** are the database rows, and only holders of the right **private key** can change a row — and only in ways the program allows.

### 2.2 The six building blocks

| # | Concept | What it is | How it operates | MedTrace use |
|---|---|---|---|---|
| 1 | **Keypair / wallet** | Public key (address) + private key (signs) | Every write carries a signature validators verify | Manufacturer, distributor, pharmacy each have a wallet; patient needs none |
| 2 | **Account** | Address + data blob + owner program | Only the owner program can modify data; storage needs a refundable rent deposit | One **Pack account** per medicine box |
| 3 | **Program** | Stateless onchain code (smart contract) | Exposes instructions; failed checks revert the whole transaction | `mint_pack`, `transfer_custody`, `dispense` |
| 4 | **PDA** (Program Derived Address) | Address derived from seeds + program ID; no private key | Same seeds → same address, always | Seeds `["pack", serial]` → a serial can exist **only once**; instant lookup from QR |
| 5 | **Transaction** | Signed bundle of instructions | Build → sign → send to RPC → validators execute → confirmed (<1s) → public on Explorer | Every custody change is a signed, auditable event |
| 6 | **Read (RPC)** | Fetch account data | Free, no signature | Patient scan → fetch Pack → verdict |

> **Governance note:** the chain knows public keys, not companies. Linking a key to a real manufacturer is a governance layer (see 2.8).

### 2.3 Pack account (data model)

| Field | Example |
|---|---|
| `serial` | `SQ-000123` |
| `batch` | `BX-2026-09` |
| `expiry` | `2028-03-31` (unix timestamp) |
| `manufacturer` | Manufacturer public key |
| `holder` | Current custodian public key |
| `status` | `Manufactured → InTransit → AtPharmacy → Dispensed` |
| `dispensed_at` | Timestamp |

### 2.4 Program instructions

| Instruction | Who can call | Rule enforced |
|---|---|---|
| `mint_pack(serial, batch, expiry)` | Manufacturer | Serial must not already exist (PDA init fails on duplicates) |
| `transfer_custody(new_holder)` | Current holder only | Cannot transfer a dispensed pack |
| `dispense()` | Current holder (pharmacy) | Can happen **once** |

### 2.5 Clone-detection logic

| Scenario | Onchain state at scan | Verdict |
|---|---|---|
| Genuine box, first sale at Pharmacy A | `AtPharmacy`, holder = A | ✅ Genuine |
| Clone offered at Pharmacy B | holder = A | ⚠️ Registered to another pharmacy |
| Clone after genuine was sold | `Dispensed` | 🚫 Already dispensed — likely counterfeit |
| Pharmacy B calls `dispense()` on clone | Rejected (not holder / already dispensed) | 🚫 Tx fails |
| Made-up serial | No account at PDA | 🚫 Unknown serial |

> Patient scans are **reads** and are not recorded onchain. The pharmacy's **`dispense()` write** is the one-time event clones cannot fake.

### 2.6 Code — Anchor program (Rust)

```rust
use anchor_lang::prelude::*;
declare_id!("YOUR_PROGRAM_ID");

#[program]
pub mod medtrace {
    use super::*;

    pub fn mint_pack(ctx: Context<MintPack>, serial: String, batch: String, expiry: i64) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        pack.manufacturer = ctx.accounts.manufacturer.key();
        pack.holder = ctx.accounts.manufacturer.key();
        pack.serial = serial;
        pack.batch = batch;
        pack.expiry = expiry;
        pack.status = Status::Manufactured;
        Ok(())
    }

    pub fn transfer_custody(ctx: Context<HolderAction>, new_holder: Pubkey) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require!(pack.status != Status::Dispensed, MedError::AlreadyDispensed);
        pack.holder = new_holder;
        pack.status = Status::InTransit;
        Ok(())
    }

    pub fn dispense(ctx: Context<HolderAction>) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require!(pack.status != Status::Dispensed, MedError::AlreadyDispensed);
        pack.status = Status::Dispensed;
        pack.dispensed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(serial: String)]
pub struct MintPack<'info> {
    #[account(init, payer = manufacturer, space = 8 + Pack::INIT_SPACE,
              seeds = [b"pack", serial.as_bytes()], bump)]   // PDA = uniqueness
    pub pack: Account<'info, Pack>,
    #[account(mut)]
    pub manufacturer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HolderAction<'info> {
    #[account(mut, has_one = holder)]                      // only current holder
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Pack {
    pub manufacturer: Pubkey,
    pub holder: Pubkey,
    #[max_len(32)] pub serial: String,
    #[max_len(32)] pub batch: String,
    pub expiry: i64,
    pub status: Status,
    pub dispensed_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status { Manufactured, InTransit, AtPharmacy, Dispensed }

#[error_code]
pub enum MedError { #[msg("Pack already dispensed")] AlreadyDispensed }
```

**Key lines:**
- `seeds = [b"pack", serial]` → one account per serial, duplicates impossible
- `has_one = holder` + `Signer` → only the current custodian can act
- `require!` → rule check; failure reverts the transaction

### 2.7 Code — client (TypeScript)

```ts
// Derive the pack address from its serial (same math as the program)
const [packPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pack"), Buffer.from(serial)], program.programId);

// WRITE — manufacturer registers a pack (wallet signs, tiny fee)
await program.methods.mintPack(serial, "BX-2026-09", new BN(expiryUnix))
  .accounts({ manufacturer: wallet.publicKey })   // Anchor auto-derives the PDA
  .rpc();

// READ — patient verification (free, no wallet)
async function verify(serial: string, scanningPharmacy?: PublicKey) {
  const pack = await program.account.pack.fetchNullable(packPda);
  if (!pack) return "🚫 Unknown serial";
  if (pack.status.dispensed) return `🚫 Already dispensed on ${new Date(pack.dispensedAt * 1000)}`;
  if (scanningPharmacy && !pack.holder.equals(scanningPharmacy)) return "⚠️ Registered to another pharmacy";
  return "✅ Genuine";
}
```

> Anchor client APIs vary by version (e.g. `accounts` vs `accountsPartial`) — verify against current docs.

### 2.8 End-to-end demo narrative

| Step | Actor | Action | Onchain result |
|---|---|---|---|
| 1 | Manufacturer | Mints `SQ-000123`, prints QR | Pack PDA created · `Manufactured` |
| 2 | Manufacturer | Transfers to Distributor | holder = Distributor · `InTransit` |
| 3 | Distributor | Transfers to Pharmacy (Dhaka) | holder = Pharmacy |
| 4 | Patient | Scans at pharmacy | ✅ Genuine |
| 5 | Pharmacy | Sells → `dispense()` | `Dispensed`, timestamped |
| 6 | Counterfeiter | Copies QR onto fake box (Sylhet) | Nothing — can't sign as holder |
| 7 | Patient (Sylhet) | Scans fake | 🚫 Already dispensed in Dhaka |
| 8 | Regulator view | Sees failed / duplicate scan location | Hotspot flagged |

### 2.9 Build options

| Option | How | Verdict |
|---|---|---|
| **A. Custom Anchor program** | Solana Playground (browser) or solana.new + Claude Code | ✅ Recommended — 3 small instructions |
| **B. Memo-only** | Events as memos via existing Memo program; logic offchain | Fallback — weaker "why blockchain" |
| **C. NFT per pack** | Metaplex / compressed NFTs | "At scale" roadmap item |

### 2.10 Production path (roadmap slide)
- **Governance:** manufacturer registry PDA approved only by a regulator (DGDA) authority key — prevents rogue wallets minting "genuine" packs
- **Cost at scale:** close accounts after dispense to reclaim rent; move to **state compression** for national volumes
- **UX:** custodial backend keys for pharmacies; patients never touch crypto
- **Physical layer:** scratch-off codes / tamper-evident seals; align with GS1 DataMatrix standards
- **Privacy:** no patient data onchain — pack lifecycle events only

---

## Glossary

| Term | Plain English |
|---|---|
| Devnet | Solana test network — free test SOL, no real value |
| SOL / lamports | Native currency (fees); 1 SOL = 1,000,000,000 lamports |
| Program | Smart contract — onchain code defining the rules |
| Account | Onchain data record owned by a program |
| PDA | Program-controlled address derived from seeds — used for uniqueness and lookup |
| Anchor | Rust framework for writing Solana programs |
| IDL | JSON "API spec" of a program, used by the frontend |
| RPC | API endpoint for reading / writing chain data |
| Explorer | Website to inspect transactions and accounts (explorer.solana.com) |

## Sources
- WHO — Substandard and falsified medical products fact sheet: https://www.who.int/news-room/fact-sheets/detail/substandard-and-falsified-medical-products
- Health Policy Watch — WHO falsified medicines estimates: https://healthpolicy-watch.news/who-delays-falsified-medicine-mechanism-reform-amid-health-crisis/
- The Daily Star — Countering counterfeit medicine in Bangladesh: https://www.thedailystar.net/health/news/countering-counterfeit-medicine-bangladesh-2971806
- Dhaka Tribune — Fake goods flood Bangladesh markets: https://www.dhakatribune.com/business/411175/crisis-deepens-as-fake-goods-flood-bangladesh
- Bangladesh Pratidin — Market flooded with counterfeit medicines: https://en.bd-pratidin.com/special/2025/12/20/53127
- New Age — Counterfeit medicines flood markets: https://www.newagebd.net/article/150157/counterfeit-medicines-flood-markets-across-bangladesh
- The New Humanitarian — Bangladesh's battle with fake medicine: https://www.thenewhumanitarian.org/feature/2013/11/04/bangladesh-s-battle-fake-and-low-standard-medicine
- Beacon Pharma — Verifying authentic medicines in Bangladesh: https://global.beaconpharma.com.bd/how-to-verify-authentic-medicines-in-bangladesh
- The Daily Star — Crypto trading not allowed in Bangladesh: https://www.thedailystar.net/business/news/trading-cryptocurrency-not-allowed-bangladesh-3120246
- GS1 — 2D barcodes in healthcare: https://www.gs1.org/industries/healthcare/2d-barcode-healthcare
- Solana docs: https://solana.com/docs · Anchor docs: https://anchor-lang.com/docs
