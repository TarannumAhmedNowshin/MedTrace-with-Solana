// Solana Playground test file — paste into `tests/anchor.test.ts` in Playground, then run `test`.
// Playground provides these globals: pg, web3, anchor, BN, assert

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
    const tx = await pg.program.methods
      .mintPack(serial, "BX-2026-09", new BN(1837036800)) // expiry 2028-03-31
      .accounts({ pack: packPda, manufacturer: pg.wallet.publicKey })
      .rpc();
    console.log("mint tx:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    const pack = await pg.program.account.pack.fetch(packPda);
    assert.equal(pack.serial, serial);
    assert.equal(pack.holder.toBase58(), pg.wallet.publicKey.toBase58());
    assert.deepEqual(pack.status, { manufactured: {} });
  });

  it("REJECTS a duplicate serial (anti-clone)", async () => {
    let failed = false;
    try {
      await pg.program.methods
        .mintPack(serial, "BX-FAKE", new BN(1837036800))
        .accounts({ pack: packPda, manufacturer: pg.wallet.publicKey })
        .rpc();
    } catch (e) {
      failed = true;
      console.log("✅ Duplicate rejected as expected");
    }
    assert.ok(failed, "Duplicate serial should not have minted");
  });

  it("transfers custody manufacturer -> distributor", async () => {
    const tx = await pg.program.methods
      .transferCustody(distributor.publicKey)
      .accounts({ pack: packPda, holder: pg.wallet.publicKey })
      .rpc();
    console.log("transfer tx:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    const pack = await pg.program.account.pack.fetch(packPda);
    assert.equal(pack.holder.toBase58(), distributor.publicKey.toBase58());
  });

  it("REJECTS a transfer from a non-holder", async () => {
    let failed = false;
    try {
      await pg.program.methods
        .transferCustody(pharmacy.publicKey)
        .accounts({ pack: packPda, holder: pg.wallet.publicKey }) // no longer the holder
        .rpc();
    } catch (e) {
      failed = true;
      console.log("✅ Non-holder transfer rejected as expected");
    }
    assert.ok(failed, "Non-holder should not be able to transfer");
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
    const tx = await pg.program.methods
      .dispense()
      .accounts({ pack: packPda, holder: pharmacy.publicKey })
      .signers([pharmacy])
      .rpc();
    console.log("dispense tx:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    const pack = await pg.program.account.pack.fetch(packPda);
    assert.deepEqual(pack.status, { dispensed: {} });
    assert.ok(pack.dispensedAt.toNumber() > 0);
    console.log("Dispensed at:", new Date(pack.dispensedAt.toNumber() * 1000));
  });

  it("REJECTS a second dispense (the clone-detection moment)", async () => {
    let failed = false;
    try {
      await pg.program.methods
        .dispense()
        .accounts({ pack: packPda, holder: pharmacy.publicKey })
        .signers([pharmacy])
        .rpc();
    } catch (e) {
      failed = true;
      console.log("✅ Double dispense rejected — this is the anti-counterfeit guarantee");
    }
    assert.ok(failed, "Double dispense should have failed");
  });
});
