/**
 * Solana Playground "Test" tab version of tests/medtrace.ts.
 * Paste into Playground → tests/medtrace.test.ts → click Test (runs against devnet).
 * Globals provided by Playground: pg, web3, anchor, BN, assert.
 * Cost: ~0.2 devnet SOL (test wallets are funded from your Playground wallet).
 */

// Works on both Anchor 0.29 (.accounts) and 0.30+ (.accountsPartial) clients.
const withAccounts = (builder: any, accounts: Record<string, unknown>) =>
  (builder.accountsPartial ?? builder.accounts).call(builder, accounts);

const PROGRAM = pg.program;
const MFR: web3.Keypair = pg.wallet.keypair;
const dist = web3.Keypair.generate();
const pharm = web3.Keypair.generate();
const otherPharm = web3.Keypair.generate();

const packPda = (serial: string) =>
  web3.PublicKey.findProgramAddressSync([Buffer.from("pack"), Buffer.from(serial)], PROGRAM.programId)[0];
const inAYear = () => new BN(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
let n = 0;
const newSerial = () => `T-${Date.now().toString(36).toUpperCase()}-${n++}`;

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e: any) {
    const anchorCode = e?.error?.errorCode?.code;
    const logs: string[] = e?.logs ?? e?.transactionLogs ?? [];
    const hit = anchorCode === code || logs.some((l) => l.includes(code)) || String(e?.message).includes(code);
    assert(hit, `expected ${code}, got ${anchorCode ?? e?.message}`);
    return;
  }
  assert.fail(`expected ${code}, but the transaction succeeded`);
}

const mint = (serial: string, batch = "B-2026-09", expiry = inAYear()) =>
  withAccounts(PROGRAM.methods.mintPack(serial, batch, expiry), {
    pack: packPda(serial),
    manufacturer: MFR.publicKey,
    systemProgram: web3.SystemProgram.programId,
  }).rpc();

const transfer = (serial: string, from: web3.Keypair, to: web3.PublicKey) =>
  withAccounts(PROGRAM.methods.transferCustody(to), { pack: packPda(serial), holder: from.publicKey })
    .signers(from === MFR ? [] : [from])
    .rpc();

const dispense = (serial: string, by: web3.Keypair) =>
  withAccounts(PROGRAM.methods.dispense(), { pack: packPda(serial), holder: by.publicKey })
    .signers(by === MFR ? [] : [by])
    .rpc();

const fetchPack = (serial: string): Promise<any> => PROGRAM.account.pack.fetch(packPda(serial));

async function packAtPharmacy() {
  const s = newSerial();
  await mint(s);
  await transfer(s, MFR, dist.publicKey);
  await transfer(s, dist, pharm.publicKey);
  return s;
}

describe("medtrace (Playground / devnet)", () => {
  before(async () => {
    const tx = new web3.Transaction();
    [dist, pharm, otherPharm].forEach((k) =>
      tx.add(web3.SystemProgram.transfer({ fromPubkey: MFR.publicKey, toPubkey: k.publicKey, lamports: 0.03 * web3.LAMPORTS_PER_SOL })),
    );
    await web3.sendAndConfirmTransaction(pg.connection, tx, [MFR]);
  });

  it("happy path: mint → transfer → transfer → dispense", async () => {
    const s = newSerial();
    await mint(s);
    let p = await fetchPack(s);
    assert(p.holder.equals(MFR.publicKey));
    assert("manufactured" in p.status);

    await transfer(s, MFR, dist.publicKey);
    p = await fetchPack(s);
    assert("inTransit" in p.status);

    await transfer(s, dist, pharm.publicKey);
    p = await fetchPack(s);
    assert("atPharmacy" in p.status);

    const tx = await dispense(s, pharm);
    p = await fetchPack(s);
    assert("dispensed" in p.status);
    assert(Math.abs(p.dispensedAt.toNumber() - Date.now() / 1000) < 300, "dispensed_at in seconds");
    console.log(`✅ ${s} dispensed: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("anti-clone: second dispense fails", async () => {
    const s = await packAtPharmacy();
    await dispense(s, pharm);
    await expectError(dispense(s, pharm), "AlreadyDispensed");
  });

  it("only the holder can transfer / dispense", async () => {
    const s = newSerial();
    await mint(s);
    await expectError(transfer(s, dist, pharm.publicKey), "NotHolder");
    const s2 = await packAtPharmacy();
    await expectError(dispense(s2, otherPharm), "NotHolder");
  });

  it("status rules", async () => {
    const s = newSerial();
    await mint(s);
    await expectError(dispense(s, MFR), "NotAtPharmacy");
    await expectError(transfer(s, MFR, MFR.publicKey), "SameHolder");
    const s2 = await packAtPharmacy();
    await expectError(transfer(s2, pharm, otherPharm.publicKey), "InvalidStatus");
  });

  it("mint validation", async () => {
    const s = newSerial();
    await mint(s);
    await expectError(mint(s), "already in use");
    await expectError(mint("sq-000123"), "InvalidSerial");
    await expectError(mint(newSerial(), ""), "InvalidBatch");
    await expectError(mint(newSerial(), "B-1", new BN(1)), "AlreadyExpired");
  });

  it("layout: holder @40 and status @72 are filterable", async () => {
    const s = await packAtPharmacy();
    const byHolder = await PROGRAM.account.pack.all([{ memcmp: { offset: 40, bytes: pharm.publicKey.toBase58() } }]);
    assert(byHolder.some((a: any) => a.account.serial === s), "holder memcmp @40");
    const atPharmacy = await PROGRAM.account.pack.all([{ memcmp: { offset: 72, bytes: "3" } }]);
    assert(atPharmacy.some((a: any) => a.account.serial === s), "status memcmp @72");
  });
});
