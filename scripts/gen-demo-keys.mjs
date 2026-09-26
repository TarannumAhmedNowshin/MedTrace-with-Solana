// Generates demo wallets with Node's built-in crypto (no deps, any Node ≥ 16).
//   node scripts/gen-demo-keys.mjs DIST PHARM OTHER_PHARM
// Prints each address + an `export <NAME>_SECRET=...` line (base58, Phantom "Import Private Key" compatible).
// Secrets go to your terminal only. Never commit or paste them in chat.
import { generateKeyPairSync } from "node:crypto";

const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) {
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let s = "";
  while (n > 0n) { s = ALPHA[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = "1" + s; }
  return s;
}

const names = process.argv.slice(2);
for (const name of names.length ? names : ["DIST", "PHARM", "OTHER_PHARM"]) {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  const seed = Buffer.from(jwk.d, "base64url");
  const pub = Buffer.from(jwk.x, "base64url");
  const secret = Buffer.concat([seed, pub]); // Solana 64-byte secret key = seed ‖ pubkey
  console.log(`\n${name} address: ${b58(pub)}`);
  console.log(`export ${name}_SECRET="${b58(secret)}"`);
}
