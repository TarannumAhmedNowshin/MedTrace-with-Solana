// Filled in by P1 after `deploy` in Solana Playground (Phase 2).
// Until then this is a placeholder — P2/P3 should be on the mock client.
export const MEDTRACE_PROGRAM_ID = "<PASTE_PROGRAM_ID_HERE>";
export const MEDTRACE_CLUSTER = "devnet" as const;
export const MEDTRACE_RPC_URL = "https://api.devnet.solana.com";

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${MEDTRACE_CLUSTER}`;
export const explorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${MEDTRACE_CLUSTER}`;
