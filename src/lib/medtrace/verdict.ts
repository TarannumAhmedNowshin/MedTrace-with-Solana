import type { Pack, VerdictResult } from "./types";

/** A pack dispensed this recently is the patient's own purchase. */
export const FRESH_DISPENSE_SECONDS = 600; // 10 minutes

export interface VerdictContext {
  /** Pharmacy wallet scanning at the counter (?pharmacy=). */
  pharmacy?: string;
}

/**
 * Pure verdict engine: the business rules (Tech Design §4.3).
 * `nowSec` is injected so the rules are deterministic and testable.
 */
export function computeVerdict(
  pack: Pack | null,
  nowSec: number,
  ctx: VerdictContext = {},
): VerdictResult {
  const base = { pack, checkedAt: nowSec, expired: !!pack && pack.expiry < nowSec };

  if (!pack) return { ...base, verdict: "UNKNOWN", reason: "notRegistered" };

  if (pack.status === "Dispensed") {
    const age = nowSec - (pack.dispensedAt ?? 0);
    return age <= FRESH_DISPENSE_SECONDS
      ? { ...base, verdict: "GENUINE", reason: "dispensedJustNow" }
      : { ...base, verdict: "ALREADY_DISPENSED", reason: "codeAlreadyUsed" };
  }

  if (ctx.pharmacy && pack.holder !== ctx.pharmacy) {
    return { ...base, verdict: "OTHER_PHARMACY", reason: "registeredElsewhere" };
  }

  return {
    ...base,
    verdict: "GENUINE",
    reason: pack.status === "AtPharmacy" ? "readyAtPharmacy" : "inSupplyChain",
  };
}
