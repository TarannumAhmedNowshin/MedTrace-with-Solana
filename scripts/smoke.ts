/**
 * Reads one pack straight from devnet using the same adapter the server uses.
 *   RPC_URL=https://... npm run smoke -- SQ-000123
 */
import { createOnchainReader } from "../src/lib/medtrace/onchain";

const serial = process.argv[2] ?? "SQ-000101";
const rpc = process.env.RPC_URL || "https://api.devnet.solana.com";

createOnchainReader(rpc)
  .getVerdict(serial)
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error("SMOKE FAILED:", e);
    process.exit(1);
  });
