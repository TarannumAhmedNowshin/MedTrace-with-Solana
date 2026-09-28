/** Helpers for Route Handlers: consistent JSON + error envelope (Tech Design §4.2). */
import { toAppError } from "./errors";
import { AppError } from "./types";
import { redact } from "./redact";

const NO_STORE = { "Cache-Control": "no-store" };

export const ok = (data: unknown, status = 200, headers: HeadersInit = NO_STORE) => Response.json(data, { status, headers });

/** Short shared cache for list endpoints: absorbs bursts so one client can't hammer the RPC. */
export const SHORT_CACHE = { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" };

/** 5xx details stay in server logs; clients get a stable, non-leaky message. */
const PUBLIC_5XX: Record<string, string> = {
  RPC_UNAVAILABLE: "The ledger is busy. Please retry.",
};

export function fail(e: unknown) {
  const err = toAppError(e);
  const status =
    err instanceof AppError && err.status !== 400
      ? err.status
      : err.code === "RPC_UNAVAILABLE"
        ? 503
        : err.code === "NOT_FOUND"
          ? 404
          : err.code === "UNKNOWN"
            ? 500
            : 400;
  if (status >= 500) {
    console.error("[api]", err.code, redact(err.message, 500));
    const message = PUBLIC_5XX[err.code] ?? "Internal error";
    return Response.json({ error: { code: err.code, message } }, { status, headers: NO_STORE });
  }
  return Response.json({ error: { code: err.code, message: redact(err.message) } }, { status, headers: NO_STORE });
}
