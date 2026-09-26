/** Helpers for Route Handlers: consistent JSON + error envelope (Tech Design §4.2). */
import { toAppError } from "./errors";
import { AppError } from "./types";

const NO_STORE = { "Cache-Control": "no-store" };

export const ok = (data: unknown, status = 200) => Response.json(data, { status, headers: NO_STORE });

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
  if (status >= 500) console.error("[api]", err.code, err.message);
  return Response.json({ error: { code: err.code, message: err.message } }, { status, headers: NO_STORE });
}
