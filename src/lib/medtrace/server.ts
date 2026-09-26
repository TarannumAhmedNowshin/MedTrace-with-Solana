/**
 * Server-side data source for Route Handlers and the /verify Server Component.
 * NEVER returns the http reader (that would make the API call itself).
 */
import { withVerdict, type MedTraceReader } from "./client";
import { config } from "./config";
import { mockStore } from "./mockStore";

/** Server RPC: private key-bearing URL (e.g. Helius) if set, else the public one. */
export const serverRpcUrl = () => process.env.RPC_URL || config.rpcUrl;

let cached: MedTraceReader | null = null;

export async function serverReader(): Promise<MedTraceReader> {
  if (cached) return cached;
  if (config.mode === "solana") {
    const { createOnchainReader } = await import("./onchain");
    cached = createOnchainReader(serverRpcUrl());
  } else {
    cached = withVerdict({
      getPack: (s) => mockStore.getPack(s),
      listPacks: (f) => mockStore.listPacks(f),
    });
  }
  return cached;
}
