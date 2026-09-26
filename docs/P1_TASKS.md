# 👤 P1 — Program Lead · My Task List

*MedTrace · Build IRL Vol. 1 · Dogpatch Labs, Dublin · 26 Sep 2026 · 10:00–18:00*

**My job in one line:** I own everything onchain. I write the Anchor program, deploy it to devnet, prove it works, and hand my team the IDL + Program ID so they can build the UI.

**The single most important thing I ship:** the **IDL + Program ID in the repo by 13:00**. Until that lands, P2 is stuck on mock data. Everything else is secondary to that.

---

## ✅ Already done
- [x] GitHub repo created
- [x] Collaborators added

---

## 🎯 My 6 deliverables

| # | Deliverable | Deadline | Who's blocked without it |
|---|---|---|---|
| 1 | Anchor program builds in Playground | 11:00 | — |
| 2 | Deployed to devnet · Program ID posted in chat | 11:00 | P2, P4 |
| 3 | All 3 instructions pass in Test tab (incl. double-dispense **fails**) | 12:30 | P4 (needs proof for deck) |
| 4 | **IDL + Program ID committed to `app/src/idl/`** | **13:00** | **P2 — hard blocker** |
| 5 | 3 funded demo wallets on the demo laptop | 13:30 | P3 (demo) |
| 6 | Explorer links for the deck | 15:30 | P4 |

Stretch (only if everything above is green): manufacturer registry so only regulator-approved wallets can mint.

---

## Phase 0 — Setup · 10:00–10:30

- [ ] Open **https://beta.solpg.io** → create new project → **Anchor (Rust)**
- [ ] Bottom-left: click the wallet icon → **Create wallet** → **save the keypair file** (this wallet owns the program — lose it and I can't redeploy)
- [ ] Set cluster to **devnet** (bottom-left status bar, click the network name)
- [ ] Get devnet SOL — in the Playground terminal:
  ```
  solana airdrop 2
  ```
  If the airdrop is rate-limited, use **https://faucet.solana.com** with my Playground wallet address. **Get at least 4 SOL** — deploys cost ~2 SOL and I will redeploy several times.
- [ ] Confirm balance:
  ```
  solana balance
  ```
- [ ] Push the planning docs to the repo (I already ran `git init` in this folder):
  ```bash
  cd /Users/tarannumnowshin/Downloads/hackthon && git branch -m main && git remote add origin https://github.com/TarannumAhmedNowshin/MedTrace-with-Solana.git && git add . && git commit -m "Add MedTrace planning docs and P1 task list" && git push -u origin main
  ```
  If the push is rejected because the repo already has a commit (a README made at creation), run this once then push again:
  ```bash
  git pull origin main --allow-unrelated-histories --no-edit && git push -u origin main
  ```
- [ ] Pin in the team chat: repo link, Playground project link, my wallet address

**Repo:** https://github.com/TarannumAhmedNowshin/MedTrace-with-Solana

> ⚠️ Playground is **not** multi-user. I am the only one who deploys. I mirror the source into `/program` in the repo so it's not trapped in a browser tab.

---

## Phase 1 — Interface contract · 10:30–10:45 (whole team)

This is the meeting that unblocks P2 and P3 to build on mocks. I must **lock these and not change them later** — if I change a name after 11:00 I break their code.

| Item | Locked value |
|---|---|
| Instructions | `mint_pack(serial, batch, expiry)` · `transfer_custody(new_holder)` · `dispense()` |
| Pack fields | `serial, batch, expiry, manufacturer, holder, status, dispensed_at` |
| Status enum | `Manufactured, InTransit, AtPharmacy, Dispensed` |
| Verify verdicts | `GENUINE` · `OTHER_PHARMACY` · `ALREADY_DISPENSED` · `UNKNOWN` |
| Serial format | `SQ-000123` (≤ 32 chars) |
| PDA seeds | `["pack", serial]` |

### ⚠️ One thing I must raise at this meeting

The agreed `transfer_custody(new_holder)` sets status to `InTransit`. **Nothing ever sets `AtPharmacy`** — so that enum value is dead unless we add something.

My recommendation: **leave it.** The verdict logic keys off `holder` and `Dispensed`, not `AtPharmacy` — the demo works fine without it. If P3 wants the pharmacy screen to literally say "At Pharmacy", I'll add a 4th one-line instruction `mark_received()` as a stretch. **Decide this in the meeting, don't discover it at 14:00.**

---

## Phase 2 — Write + deploy · 10:45–12:00

- [ ] Paste the program from **Appendix A** into `src/lib.rs` in Playground
- [ ] Build:
  ```
  build
  ```
  Fix errors until clean. Playground auto-fills `declare_id!` — don't hand-edit it.
- [ ] Deploy:
  ```
  deploy
  ```
- [ ] **Copy the Program ID.** Post it in the team chat immediately, with the Explorer link:
  ```
  https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet
  ```
- [ ] Commit the source to the repo so it isn't only in a browser tab:
  ```bash
  mkdir -p program/src && cp <lib.rs> program/src/lib.rs && git add program && git commit -m "program: Anchor source (mirrors Playground)" && git push
  ```

**🚦 11:00 checkpoint:** `mint_pack` deployed, tx visible on Explorer. If I'm behind → say so in chat, and simplify (drop `batch`/`expiry` fields to get *something* deployed).

---

## Phase 3 — Test every instruction · 12:00–12:30

Two ways to test in Playground — do both:

**A. Test tab (clicky, fast).** Playground auto-generates a form UI from my IDL. Good for a quick sanity check and for screenshotting for P4's deck.

**B. Test file (repeatable, proves the failure case).** Paste **Appendix B** into `tests/anchor.test.ts`, then:
```
test
```

- [ ] `mint_pack` creates the Pack PDA
- [ ] Minting the **same serial twice fails** ← this is the anti-clone guarantee, the whole pitch
- [ ] `transfer_custody` moves the holder
- [ ] A **non-holder cannot transfer** ← proves custody is enforced
- [ ] `dispense` marks it dispensed with a timestamp
- [ ] **Double-dispense fails** ← this is the clone-detection moment in the demo
- [ ] Screenshot the passing test output → send to P4 for the deck

**🚦 12:30 checkpoint:** all 3 instructions pass. If behind → drop `transfer_custody`, demo `mint → dispense → clone fails`. The clone story still lands.

---

## Phase 4 — 🔴 Ship the IDL · 12:30–13:00 (MY CRITICAL PATH)

**This unblocks P2. Nothing I do today matters more.**

- [ ] In Playground: left sidebar → **Program** (the wrench/gear icon) → **Export IDL** → downloads `medtrace.json`
- [ ] Copy it into the repo at `app/src/idl/medtrace.json`
- [ ] Also write the Program ID where P2 can import it — create `app/src/idl/programId.ts`:
  ```ts
  export const MEDTRACE_PROGRAM_ID = "<PASTE_PROGRAM_ID_HERE>";
  ```
- [ ] Commit and push:
  ```bash
  git add app/src/idl && git commit -m "idl: ship MedTrace IDL + program ID for frontend" && git push
  ```
- [ ] Post in chat: **"IDL is in `app/src/idl/medtrace.json`, Program ID `<...>`, devnet. @P2 you're unblocked."**
- [ ] Sit with P2 for the first real call — the first integration attempt always fails on something dumb (wrong cluster, stale IDL, Anchor version mismatch). See Appendix D.

**🚦 13:00 checkpoint:** IDL in repo + P2's first frontend call succeeds. If it doesn't → I pair with P2, this is now my only job.

---

## Phase 5 — Demo wallets · 13:00–13:30

The demo needs 3 wallets that can each sign: **Manufacturer**, **Distributor**, **Pharmacy**.

- [ ] Create 3 Phantom wallets (or 3 accounts in one Phantom) → **switch Phantom to Devnet** (Settings → Developer Settings → Testnet Mode → Devnet)
- [ ] Fund **each** with devnet SOL via **https://faucet.solana.com** (~1 SOL each is plenty)
- [ ] Verify each balance is non-zero **before** the demo
- [ ] Put all 3 on the **demo laptop** (the one P3 drives) and label them clearly
- [ ] Post the 3 public keys in chat so P2 can hardcode the transfer targets if needed

> Why they need SOL: each wallet pays its own transaction fee when it signs. In the Playground tests the fee payer is my Playground wallet, so test keypairs don't need funding — but in the live demo they do. **Don't skip this and discover it on stage.**

> 🔒 Never commit a keypair or seed phrase. Devnet-only, but the habit matters and judges notice.

---

## Phase 6 — Support + stretch · 13:30–15:30

- [ ] **Priority: unblock P2.** Debugging integration beats building anything new.
- [ ] Keep a running list of good Explorer links for P4's deck: a mint tx, a transfer tx, a dispense tx, and a **failed** double-dispense tx (the failure is the most persuasive one)
- [ ] *Stretch only if green:* manufacturer registry — a `Registry` PDA holding a regulator authority key; `mint_pack` requires the manufacturer to be approved. This answers the judge question *"what stops a counterfeiter from just minting their own 'genuine' packs?"*
- [ ] Prepare answers to the likely judge questions (see below)

**❄️ 15:30 — feature freeze.** No new instructions after this. Redeploying a program invalidates P2's working integration; a broken demo costs more than a missing feature.

---

## Phase 7 — After freeze · 15:30–17:00+

- [ ] Hand P4 all Explorer links and the Program ID for the deck
- [ ] Final push: make sure `/program` in the repo matches what's actually deployed
- [ ] Be ready to **field technical questions from judges** — that's my presenting role
- [ ] Attend both rehearsals

---

## 🎤 Judge questions I should have answers ready for

| Question | My answer |
|---|---|
| *"Why blockchain instead of a database?"* | Multi-party, low-trust. Manufacturers, distributors, pharmacies and DGDA all write to one neutral record — and dishonest manufacturers are part of the problem, so no single party can own the database. One verification layer instead of 229 manufacturer apps. |
| *"What stops someone photocopying the QR?"* | Nothing — and that's the point. A clone scans fine but the chain says the serial is *already dispensed* or *held by another pharmacy*. We don't protect the code, we protect the **lifecycle**. |
| *"What stops a counterfeiter minting their own packs?"* | Today, nothing at the program level — that's the registry (regulator-approved manufacturer keys) on the roadmap. Honest about it. |
| *"Why is the serial unique?"* | PDA seeds `["pack", serial]` — same seeds always derive the same address, and `init` fails if it already exists. Uniqueness is enforced by the runtime, not by my code. |
| *"Cost at scale?"* | ~0.002 SOL rent per pack, reclaimable by closing the account after dispense; state compression for national volumes. |
| *"Is this legal in Bangladesh?"* | Non-payment use. The 2026 National Blockchain Policy requires Bangladesh Bank authorization for *payment* apps — records and verification are the lower-risk lane. |

---

## Appendix A — The program (`src/lib.rs`)

```rust
use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111"); // Playground overwrites this on build

#[program]
pub mod medtrace {
    use super::*;

    /// Manufacturer registers a new pack. PDA init fails if the serial already exists.
    pub fn mint_pack(
        ctx: Context<MintPack>,
        serial: String,
        batch: String,
        expiry: i64,
    ) -> Result<()> {
        require!(serial.len() <= 32, MedError::SerialTooLong);
        require!(batch.len() <= 32, MedError::BatchTooLong);

        let pack = &mut ctx.accounts.pack;
        pack.manufacturer = ctx.accounts.manufacturer.key();
        pack.holder = ctx.accounts.manufacturer.key();
        pack.serial = serial;
        pack.batch = batch;
        pack.expiry = expiry;
        pack.status = Status::Manufactured;
        pack.dispensed_at = 0;
        Ok(())
    }

    /// Current holder hands custody to the next party in the chain.
    pub fn transfer_custody(ctx: Context<HolderAction>, new_holder: Pubkey) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require!(pack.status != Status::Dispensed, MedError::AlreadyDispensed);
        pack.holder = new_holder;
        pack.status = Status::InTransit;
        Ok(())
    }

    /// Pharmacy sells the pack. Can only ever happen once.
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
    #[account(
        init,
        payer = manufacturer,
        space = 8 + Pack::INIT_SPACE,
        seeds = [b"pack", serial.as_bytes()],
        bump
    )] // PDA seeds = uniqueness: one account per serial, duplicates impossible
    pub pack: Account<'info, Pack>,
    #[account(mut)]
    pub manufacturer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HolderAction<'info> {
    #[account(mut, has_one = holder @ MedError::NotHolder)] // only the current custodian can act
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Pack {
    pub manufacturer: Pubkey,
    pub holder: Pubkey,
    #[max_len(32)]
    pub serial: String,
    #[max_len(32)]
    pub batch: String,
    pub expiry: i64,
    pub status: Status,
    pub dispensed_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status {
    Manufactured,
    InTransit,
    AtPharmacy,
    Dispensed,
}

#[error_code]
pub enum MedError {
    #[msg("Pack already dispensed")]
    AlreadyDispensed,
    #[msg("Only the current holder can do this")]
    NotHolder,
    #[msg("Serial too long (max 32 chars)")]
    SerialTooLong,
    #[msg("Batch too long (max 32 chars)")]
    BatchTooLong,
}
```

**The three lines that carry the whole pitch:**
- `seeds = [b"pack", serial.as_bytes()]` → a serial can exist **only once**, enforced by the runtime
- `has_one = holder` + `Signer` → only the current custodian can move or sell the pack
- `require!(... != Status::Dispensed)` → **dispense happens once**; this is the check that catches the clone

---

## Appendix B — Playground test file (`tests/anchor.test.ts`)

```ts
// Solana Playground provides these globals: pg, web3, anchor, BN, assert

describe("medtrace", () => {
  // Unique serial per run so re-running tests doesn't hit "already in use"
  const serial = `SQ-${Math.floor(Math.random() * 900000) + 100000}`;
  const distributor = web3.Keypair.generate();
  const pharmacy = web3.Keypair.generate();

  const [packPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pack"), Buffer.from(serial)],
    pg.program.programId
  );

  it("mints a pack", async () => {
    await pg.program.methods
      .mintPack(serial, "BX-2026-09", new BN(1837036800)) // expiry 2028-03-31
      .accounts({ pack: packPda, manufacturer: pg.wallet.publicKey })
      .rpc();

    const pack = await pg.program.account.pack.fetch(packPda);
    console.log("Pack:", pack);
    assert.equal(pack.serial, serial);
    assert.equal(pack.holder.toBase58(), pg.wallet.publicKey.toBase58());
    assert.deepEqual(pack.status, { manufactured: {} });
  });

  it("REJECTS a duplicate serial (anti-clone)", async () => {
    try {
      await pg.program.methods
        .mintPack(serial, "BX-FAKE", new BN(1837036800))
        .accounts({ pack: packPda, manufacturer: pg.wallet.publicKey })
        .rpc();
      assert.fail("Duplicate serial should not have minted");
    } catch (e) {
      console.log("✅ Duplicate rejected as expected");
    }
  });

  it("transfers custody manufacturer -> distributor", async () => {
    await pg.program.methods
      .transferCustody(distributor.publicKey)
      .accounts({ pack: packPda, holder: pg.wallet.publicKey })
      .rpc();

    const pack = await pg.program.account.pack.fetch(packPda);
    assert.equal(pack.holder.toBase58(), distributor.publicKey.toBase58());
  });

  it("REJECTS a transfer from a non-holder", async () => {
    try {
      await pg.program.methods
        .transferCustody(pharmacy.publicKey)
        .accounts({ pack: packPda, holder: pg.wallet.publicKey }) // no longer the holder
        .rpc();
      assert.fail("Non-holder should not be able to transfer");
    } catch (e) {
      console.log("✅ Non-holder transfer rejected as expected");
    }
  });

  it("transfers custody distributor -> pharmacy", async () => {
    await pg.program.methods
      .transferCustody(pharmacy.publicKey)
      .accounts({ pack: packPda, holder: distributor.publicKey })
      .signers([distributor])
      .rpc();

    const pack = await pg.program.account.pack.fetch(packPda);
    assert.equal(pack.holder.toBase58(), pharmacy.publicKey.toBase58());
  });

  it("dispenses at the pharmacy", async () => {
    await pg.program.methods
      .dispense()
      .accounts({ pack: packPda, holder: pharmacy.publicKey })
      .signers([pharmacy])
      .rpc();

    const pack = await pg.program.account.pack.fetch(packPda);
    assert.deepEqual(pack.status, { dispensed: {} });
    assert.ok(pack.dispensedAt.toNumber() > 0);
    console.log("Dispensed at:", new Date(pack.dispensedAt.toNumber() * 1000));
  });

  it("REJECTS a second dispense (the clone-detection moment)", async () => {
    try {
      await pg.program.methods
        .dispense()
        .accounts({ pack: packPda, holder: pharmacy.publicKey })
        .signers([pharmacy])
        .rpc();
      assert.fail("Double dispense should have failed");
    } catch (e) {
      console.log("✅ Double dispense rejected — this is the anti-counterfeit guarantee");
    }
  });
});
```

> The generated `distributor` / `pharmacy` keypairs need **no SOL** here — my Playground wallet pays the fees. The *live demo* Phantom wallets **do** need funding (Phase 5).

---

## Appendix C — Command cheat sheet

**Playground terminal:**
```
build
deploy
test
solana balance
solana airdrop 2
solana address
```

**Local git (this folder):**
```bash
git add . && git commit -m "message" && git push
```

**Links to keep open:**
- Playground → https://beta.solpg.io
- Faucet → https://faucet.solana.com
- Explorer (devnet) → https://explorer.solana.com/?cluster=devnet
- Anchor docs → https://anchor-lang.com/docs

---

## Appendix D — Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Attempt to debit an account but found no record of a prior credit` | No devnet SOL. `solana airdrop 2` or use the web faucet. |
| Deploy fails / runs out of funds mid-deploy | Need ~2 SOL per deploy. Top up to 4+ and retry — a half-finished deploy can be resumed with `solana program deploy --buffer`. |
| `already in use` on mint | That serial's PDA exists. **This is correct behaviour** — use a fresh serial. |
| `A seeds constraint was violated` | The client derived the PDA with a different seed string than the program. Check exact casing of `"pack"` and the serial. |
| P2 gets `AccountNotFound` / decode errors | Stale IDL, or the frontend is on mainnet. Re-export the IDL after **every** redeploy, and confirm P2's RPC is devnet. |
| `accounts` vs `accountsPartial` type error in P2's code | Anchor version difference. Newer Anchor wants `.accountsPartial({...})` when some accounts are auto-derivable. Try swapping it. |
| Airdrop rate-limited | Use https://faucet.solana.com in the browser instead of the CLI. |
| Everything worked, then broke after a redeploy | A redeploy can change the IDL. Re-export, recommit, tell P2. **This is why we freeze at 15:30.** |

---

## ⏱ My day at a glance

| Time | Me |
|---|---|
| 10:00–10:30 | Playground setup, wallet, airdrop, push docs |
| 10:30–10:45 | 🤝 Interface contract — **raise the `AtPharmacy` gap** |
| 10:45–12:00 | Write + deploy program · **🚦 11:00: deployed** |
| 12:00–12:30 | Test all instructions · **🚦 12:30: all pass** |
| 12:30–13:00 | 🔴 **Ship IDL + Program ID** · **🚦 13:00: P2 unblocked** |
| 13:00–13:30 | 🍽 Lunch + fund 3 demo wallets |
| 13:30–15:30 | Unblock P2 · stretch: registry |
| 15:30 | ❄️ Freeze — no new instructions |
| 15:30–17:00 | Explorer links to P4 · rehearse |
| 17:00+ | 🎤 Final rehearsal · I field technical Qs |

**Rule: blocked more than 20 minutes → say so in chat immediately.**
