/**
 * Generates a PLACEHOLDER Anchor (0.30+ format) IDL that matches Tech Design §3,
 * so the frontend compiles and the onchain adapter can be wired before P1 ships.
 * P1: overwrite anchor/idl/medtrace.json with the IDL exported from Solana Playground.
 *
 *   node scripts/gen-placeholder-idl.cjs > anchor/idl/medtrace.json
 */
const crypto = require("crypto");
const disc = (s) => [...crypto.createHash("sha256").update(s).digest().subarray(0, 8)];

const idl = {
  address: "11111111111111111111111111111111", // PLACEHOLDER: replaced by the real program ID
  metadata: {
    name: "medtrace",
    version: "0.1.0",
    spec: "0.1.0",
    description: "PLACEHOLDER IDL generated from Tech Design §3. Replace with the Playground export.",
  },
  instructions: [
    {
      name: "dispense",
      discriminator: disc("global:dispense"),
      accounts: [
        { name: "pack", writable: true },
        { name: "holder", signer: true, relations: ["pack"] },
      ],
      args: [],
    },
    {
      name: "mint_pack",
      discriminator: disc("global:mint_pack"),
      accounts: [
        {
          name: "pack",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [...Buffer.from("pack")] },
              { kind: "arg", path: "serial" },
            ],
          },
        },
        { name: "manufacturer", writable: true, signer: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "serial", type: "string" },
        { name: "batch", type: "string" },
        { name: "expiry", type: "i64" },
      ],
    },
    {
      name: "transfer_custody",
      discriminator: disc("global:transfer_custody"),
      accounts: [
        { name: "pack", writable: true },
        { name: "holder", signer: true, relations: ["pack"] },
      ],
      args: [{ name: "new_holder", type: "pubkey" }],
    },
  ],
  accounts: [{ name: "Pack", discriminator: disc("account:Pack") }],
  events: ["CustodyTransferred", "PackDispensed", "PackMinted"].map((name) => ({
    name,
    discriminator: disc(`event:${name}`),
  })),
  errors: [
    ["InvalidSerial", "Serial must be 1-32 characters of A-Z, 0-9 or '-'"],
    ["InvalidBatch", "Batch must be 1-16 printable characters"],
    ["AlreadyExpired", "Expiry must be in the future"],
    ["NotHolder", "Signer is not the current holder"],
    ["SameHolder", "New holder equals current holder"],
    ["InvalidStatus", "Transfer not allowed in current status"],
    ["NotAtPharmacy", "Pack must be at a pharmacy to dispense"],
    ["AlreadyDispensed", "Pack has already been dispensed"],
  ].map(([name, msg], i) => ({ code: 6000 + i, name, msg })),
  types: [
    {
      name: "CustodyTransferred",
      type: {
        kind: "struct",
        fields: [
          { name: "serial", type: "string" },
          { name: "from", type: "pubkey" },
          { name: "to", type: "pubkey" },
          { name: "status", type: { defined: { name: "PackStatus" } } },
          { name: "ts", type: "i64" },
        ],
      },
    },
    {
      name: "Pack",
      type: {
        kind: "struct",
        fields: [
          { name: "manufacturer", type: "pubkey" },
          { name: "holder", type: "pubkey" },
          { name: "status", type: { defined: { name: "PackStatus" } } },
          { name: "expiry", type: "i64" },
          { name: "dispensed_at", type: "i64" },
          { name: "created_at", type: "i64" },
          { name: "bump", type: "u8" },
          { name: "serial", type: "string" },
          { name: "batch", type: "string" },
        ],
      },
    },
    {
      name: "PackDispensed",
      type: {
        kind: "struct",
        fields: [
          { name: "serial", type: "string" },
          { name: "pharmacy", type: "pubkey" },
          { name: "ts", type: "i64" },
        ],
      },
    },
    {
      name: "PackMinted",
      type: {
        kind: "struct",
        fields: [
          { name: "serial", type: "string" },
          { name: "manufacturer", type: "pubkey" },
          { name: "batch", type: "string" },
          { name: "expiry", type: "i64" },
          { name: "ts", type: "i64" },
        ],
      },
    },
    {
      name: "PackStatus",
      type: {
        kind: "enum",
        variants: [{ name: "Manufactured" }, { name: "InTransit" }, { name: "AtPharmacy" }, { name: "Dispensed" }],
      },
    },
  ],
};

process.stdout.write(JSON.stringify(idl, null, 2) + "\n");
