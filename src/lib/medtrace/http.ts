/**
 * REST adapter (Tech Design §4.2). Reads go through the API so the RPC key stays
 * on the server and a future indexer can replace the API without UI changes.
 */
import { withVerdict, type MedTraceReader, type MedTraceWriter } from "./client";
import { normalizeSerial } from "./serial";
import { AppError, type AppErrorCode, type Pack, type PackFilter, type TxResult, type VerdictResult } from "./types";
import type { VerdictContext } from "./verdict";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  } catch (e) {
    throw new AppError("RPC_UNAVAILABLE", String(e), 503);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { code?: AppErrorCode; message?: string } }).error;
    throw new AppError(err?.code ?? "UNKNOWN", err?.message, res.status);
  }
  return body as T;
}

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export function createHttpReader(base = ""): MedTraceReader {
  const packUrl = (s: string) => `${base}/api/packs/${encodeURIComponent(normalizeSerial(s))}`;
  const r = withVerdict({
    async getPack(serial) {
      try {
        return await request<Pack>(packUrl(serial));
      } catch (e) {
        if (e instanceof AppError && e.code === "NOT_FOUND") return null;
        throw e;
      }
    },
    listPacks: (f: PackFilter = {}) => request<Pack[]>(`${base}/api/packs${qs({ holder: f.holder, status: f.status })}`),
  });
  // Prefer the server's verdict endpoint (single source of truth for "now").
  r.getVerdict = (serial: string, ctx: VerdictContext = {}) =>
    request<VerdictResult>(`${packUrl(serial)}/verdict${qs({ pharmacy: ctx.pharmacy })}`);
  return r;
}

/** Mock-mode writes: the server mock store applies the same rules as the program. */
export function createMockTxWriter(base: string, signer: string): MedTraceWriter {
  const post = (action: string, body: object) =>
    request<TxResult>(`${base}/api/mock/tx/${action}`, { method: "POST", body: JSON.stringify({ signer, ...body }) });
  return {
    mintPack: (input) => post("mint", input),
    transferCustody: (serial, newHolder) => post("transfer", { serial, newHolder }),
    dispense: (serial) => post("dispense", { serial }),
  };
}
