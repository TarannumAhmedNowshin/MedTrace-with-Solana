/**
 * Integration tests: `anchor test` (spins up a local validator).
 * Same scenarios as playground/tests/medtrace.test.ts, so both stay in sync.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import type { Medtrace } from "../target/types/medtrace";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.Medtrace as Program<Medtrace>;

const packPda = (serial: string) =>
  PublicKey.findProgramAddressSync([Buffer.from("pack"), Buffer.from(serial)], program.programId)[0];

const inAYear = () => new BN(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
let counter = 0;
const newSerial = () => `T-${Date.now().toString(36).toUpperCase()}-${counter++}`;

const mfr = (provider.wallet as anchor.Wallet).payer; // manufacturer = provider wallet
const dist = Keypair.generate();
const pharm = Keypair.generate();
const otherPharm = Keypair.generate();

/** Fund test wallets from the provider (works on localnet and devnet, no airdrop limits). */
async function fund(...kps: Keypair[]) {
  const tx = new Transaction();
  kps.forEach((k) =>
    tx.add(SystemProgram.transfer({ fromPubkey: mfr.publicKey, toPubkey: k.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })),
  );
  await provider.sendAndConfirm(tx);
}

/** Assert a transaction fails with a given Anchor error name (or log substring). */
async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e: any) {
    const anchorCode = e?.error?.errorCode?.code;
    const logs: string[] = e?.logs ?? e?.transactionLogs ?? [];
    const hit = anchorCode === code || logs.some((l) => l.includes(code)) || String(e?.message).includes(code);
    assert.isTrue(hit, `expected ${code}, got ${anchorCode ?? e?.message}`);
    return;
  }
  assert.fail(`expected ${code}, but the transaction succeeded`);
}

const mint = (serial: string, batch = "B-2026-09", expiry = inAYear()) =>
  program.methods
    .mintPack(serial, batch, expiry)
    .accountsPartial({ pack: packPda(serial), manufacturer: mfr.publicKey })
    .rpc();

const transfer = (serial: string, from: Keypair, to: PublicKey) =>
  program.methods
    .transferCustody(to)
    .accountsPartial({ pack: packPda(serial), holder: from.publicKey })
    .signers(from === mfr ? [] : [from])
    .rpc();

const dispense = (serial: string, by: Keypair) =>
  program.methods
    .dispense()
    .accountsPartial({ pack: packPda(serial), holder: by.publicKey })
    .signers(by === mfr ? [] : [by])
    .rpc();

const fetchPack = (serial: string) => program.account.pack.fetch(packPda(serial));

/** Take a fresh pack all the way to the pharmacy. */
async function packAtPharmacy() {
  const s = newSerial();
  await mint(s);
  await transfer(s, mfr, dist.publicKey);
  await transfer(s, dist, pharm.publicKey);
  return s;
}

describe("medtrace", () => {
  before(async () => fund(dist, pharm, otherPharm));

  describe("happy path", () => {
    it("mint → transfer → transfer → dispense", async () => {
      const s = newSerial();

      await mint(s);
      let p = await fetchPack(s);
      assert.equal(p.serial, s);
      assert.ok(p.manufacturer.equals(mfr.publicKey));
      assert.ok(p.holder.equals(mfr.publicKey));
      assert.deepEqual(p.status, { manufactured: {} });
      assert.equal(p.dispensedAt.toNumber(), 0);

      await transfer(s, mfr, dist.publicKey);
      p = await fetchPack(s);
      assert.deepEqual(p.status, { inTransit: {} });
      assert.ok(p.holder.equals(dist.publicKey));

      await transfer(s, dist, pharm.publicKey);
      p = await fetchPack(s);
      assert.deepEqual(p.status, { atPharmacy: {} });

      await dispense(s, pharm);
      p = await fetchPack(s);
      assert.deepEqual(p.status, { dispensed: {} });
      const now = Math.floor(Date.now() / 1000);
      assert.approximately(p.dispensedAt.toNumber(), now, 120, "dispensed_at is unix SECONDS, close to now");
    });
  });

  describe("anti-clone: dispense exactly once", () => {
    it("rejects a second dispense", async () => {
      const s = await packAtPharmacy();
      await dispense(s, pharm);
      await expectError(dispense(s, pharm), "AlreadyDispensed");
    });

    it("rejects transfer after dispense", async () => {
      const s = await packAtPharmacy();
      await dispense(s, pharm);
      await expectError(transfer(s, pharm, otherPharm.publicKey), "AlreadyDispensed");
    });
  });

  describe("custody & authorization", () => {
    it("only the holder can transfer", async () => {
      const s = newSerial();
      await mint(s);
      await expectError(transfer(s, dist, pharm.publicKey), "NotHolder");
    });

    it("only the holder can dispense", async () => {
      const s = await packAtPharmacy();
      await expectError(dispense(s, otherPharm), "NotHolder");
    });

    it("cannot dispense before reaching a pharmacy", async () => {
      const s = newSerial();
      await mint(s);
      await expectError(dispense(s, mfr), "NotAtPharmacy");
      await transfer(s, mfr, dist.publicKey);
      await expectError(dispense(s, dist), "NotAtPharmacy");
    });

    it("cannot transfer onward from a pharmacy", async () => {
      const s = await packAtPharmacy();
      await expectError(transfer(s, pharm, otherPharm.publicKey), "InvalidStatus");
    });

    it("cannot transfer to yourself", async () => {
      const s = newSerial();
      await mint(s);
      await expectError(transfer(s, mfr, mfr.publicKey), "SameHolder");
    });
  });

  describe("mint validation", () => {
    it("rejects a duplicate serial", async () => {
      const s = newSerial();
      await mint(s);
      await expectError(mint(s), "already in use");
    });

    it("rejects lowercase / invalid characters (look-alike serials)", async () => {
      await expectError(mint("sq-000123"), "InvalidSerial");
      await expectError(mint("SQ 000123"), "InvalidSerial");
    });

    it("rejects an empty or oversized batch", async () => {
      await expectError(mint(newSerial(), ""), "InvalidBatch");
      await expectError(mint(newSerial(), "B".repeat(17)), "InvalidBatch");
    });

    it("rejects an expiry in the past", async () => {
      await expectError(mint(newSerial(), "B-1", new BN(1)), "AlreadyExpired");
    });
  });

  describe("account layout (frontend memcmp contract)", () => {
    it("holder is filterable at offset 40 and status at offset 72", async () => {
      const s = await packAtPharmacy();
      const byHolder = await program.account.pack.all([{ memcmp: { offset: 40, bytes: pharm.publicKey.toBase58() } }]);
      assert.isTrue(byHolder.some((a) => a.account.serial === s), "holder memcmp @40");

      const atPharmacy = await program.account.pack.all([{ memcmp: { offset: 72, bytes: "3" } }]); // bs58([2]) = AtPharmacy
      assert.isTrue(atPharmacy.some((a) => a.account.serial === s), "status memcmp @72");
      assert.isTrue(atPharmacy.every((a) => "atPharmacy" in (a.account.status as object)));
    });
  });
});
