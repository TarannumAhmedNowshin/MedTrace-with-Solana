/**
 * Normalises any thrown value (Anchor, wallet, RPC, fetch, mock) into an AppError.
 * Duck-typed on purpose: no Anchor import, so it's safe in every bundle.
 */
import { AppError, type AppErrorCode } from "./types";

const PROGRAM_CODES = new Set<AppErrorCode>([
  "InvalidSerial",
  "InvalidBatch",
  "AlreadyExpired",
  "NotHolder",
  "SameHolder",
  "InvalidStatus",
  "NotAtPharmacy",
  "AlreadyDispensed",
]);

type Anyish = {
  code?: unknown;
  message?: unknown;
  logs?: unknown;
  transactionLogs?: unknown;
  error?: { errorCode?: { code?: unknown } };
};

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as Anyish;

  // 1. AnchorError: err.error.errorCode.code
  const anchorCode = err.error?.errorCode?.code;
  if (typeof anchorCode === "string" && PROGRAM_CODES.has(anchorCode as AppErrorCode)) {
    return new AppError(anchorCode as AppErrorCode);
  }

  // 2. Program logs: "Error Code: AlreadyDispensed"
  const logs = (Array.isArray(err.logs) ? err.logs : Array.isArray(err.transactionLogs) ? err.transactionLogs : []) as string[];
  for (const line of logs) {
    const m = /Error Code: (\w+)/.exec(line);
    if (m && PROGRAM_CODES.has(m[1] as AppErrorCode)) return new AppError(m[1] as AppErrorCode);
    if (/already in use/i.test(line)) return new AppError("SerialTaken");
  }

  // 3. Message heuristics (wallet / RPC)
  const msg = String(err.message ?? e ?? "");
  const rules: [RegExp, AppErrorCode][] = [
    [/user rejected|rejected the request|cancell?ed/i, "USER_REJECTED"],
    [/already been processed/i, "DUPLICATE_TX"],
    [/blockhash not found|block height exceeded|expired/i, "BLOCKHASH_EXPIRED"],
    [/already in use/i, "SerialTaken"],
    [/insufficient (funds|lamports)|no record of a prior credit/i, "INSUFFICIENT_FUNDS"],
    [/wallet not connected|WalletNotConnected/i, "WALLET_NOT_CONNECTED"],
    [/429|too many requests|failed to fetch|network ?error|ECONN|timeout/i, "RPC_UNAVAILABLE"],
  ];
  for (const [re, code] of rules) if (re.test(msg)) return new AppError(code, msg);

  return new AppError("UNKNOWN", msg || "Unknown error");
}
