/** Server-side health probe shared by /api/health and the /status page. */
import { config } from "./config";
import { serverRpcUrl } from "./server";
import { redact } from "./redact";

export interface Health {
  ok: boolean;
  mode: "solana" | "mock";
  requestedMode: string;
  cluster: string;
  programId: string | null;
  rpcReachable: boolean | null; // null in mock mode (not checked)
  slot: number | null;
  programDeployed: boolean | null; // executable account found at programId
  problems: string[];
}

export async function checkHealth(): Promise<Health> {
  const h: Health = {
    ok: true,
    mode: config.mode,
    requestedMode: config.requestedMode,
    cluster: config.cluster,
    programId: config.programId,
    rpcReachable: null,
    slot: null,
    programDeployed: null,
    problems: [],
  };

  if (config.requestedMode === "solana" && !config.programId) {
    h.problems.push("NEXT_PUBLIC_MEDTRACE_MODE=solana but no program ID: commit the deployed IDL or set NEXT_PUBLIC_PROGRAM_ID.");
  }
  if (config.mode === "mock") {
    h.ok = h.problems.length === 0;
    return h;
  }

  const { Connection, PublicKey } = await import("@solana/web3.js");
  const connection = new Connection(serverRpcUrl(), "confirmed");
  try {
    h.slot = await connection.getSlot();
    h.rpcReachable = true;
  } catch (e) {
    h.rpcReachable = false;
    h.problems.push(`RPC unreachable (${config.cluster}): ${redact((e as Error).message ?? e, 120)}`);
  }
  if (h.rpcReachable && config.programId) {
    try {
      const info = await connection.getAccountInfo(new PublicKey(config.programId));
      h.programDeployed = !!info?.executable;
      if (!h.programDeployed) h.problems.push(`No deployed program at ${config.programId} on ${config.cluster}.`);
    } catch (e) {
      h.problems.push(`Program lookup failed: ${redact((e as Error).message ?? e, 120)}`);
    }
  }
  h.ok = h.problems.length === 0;
  return h;
}
