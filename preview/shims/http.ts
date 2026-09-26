// Preview replacement for src/lib/medtrace/http.ts: the SAME MockStore the server uses in
// mock mode, running in the browser instead of behind /api/*.
import { withVerdict, type MedTraceReader, type MedTraceWriter } from "../../src/lib/medtrace/client";
import { MockStore } from "../../src/lib/medtrace/mockStore";
import type { TxResult } from "../../src/lib/medtrace/types";

export const previewStore = new MockStore(undefined, 650);

export function createHttpReader(_base = ""): MedTraceReader {
  return withVerdict({ getPack: (s) => previewStore.getPack(s), listPacks: (f) => previewStore.listPacks(f) });
}

const tx = async (p: Promise<string>): Promise<TxResult> => ({ signature: await p, explorerUrl: null, simulated: true });

export function createMockTxWriter(_base: string, signer: string): MedTraceWriter {
  return {
    mintPack: (i) => tx(previewStore.mintPack(signer, i)),
    transferCustody: (s, h) => tx(previewStore.transferCustody(signer, s, h)),
    dispense: (s) => tx(previewStore.dispense(signer, s)),
  };
}
