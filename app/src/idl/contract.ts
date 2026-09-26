// MedTrace interface contract — LOCKED at the 10:30 team meeting.
// Owned by P1. Both the mock client and the real client must return these shapes.
// Do not rename anything here after 11:00 without telling the whole team.

export const PACK_SEED = "pack"; // PDA seeds = ["pack", serial]
export const SERIAL_MAX_LEN = 32;
export const SERIAL_REGEX = /^SQ-\d{6}$/; // e.g. SQ-000123

export type PackStatus = "Manufactured" | "InTransit" | "AtPharmacy" | "Dispensed";

export type Verdict = "GENUINE" | "OTHER_PHARMACY" | "ALREADY_DISPENSED" | "UNKNOWN";

/** A Pack account, normalised to plain JS types (base58 keys, unix seconds). */
export interface Pack {
  serial: string;
  batch: string;
  expiry: number; // unix seconds
  manufacturer: string; // base58 pubkey
  holder: string; // base58 pubkey
  status: PackStatus;
  dispensedAt: number; // unix seconds, 0 if not dispensed
}

export interface VerifyResult {
  verdict: Verdict;
  pack: Pack | null;
}

/**
 * The clone-detection rule, as pure logic. Mock and real clients both call this,
 * so the verify page behaves identically before and after the swap.
 */
export function verdictFor(pack: Pack | null, scanningPharmacy?: string): Verdict {
  if (!pack) return "UNKNOWN";
  if (pack.status === "Dispensed") return "ALREADY_DISPENSED";
  if (scanningPharmacy && pack.holder !== scanningPharmacy) return "OTHER_PHARMACY";
  return "GENUINE";
}

/**
 * Anchor returns enums as `{ manufactured: {} }` — convert to the contract's string form.
 */
export function statusFromAnchor(raw: Record<string, unknown>): PackStatus {
  const key = Object.keys(raw)[0];
  const map: Record<string, PackStatus> = {
    manufactured: "Manufactured",
    inTransit: "InTransit",
    atPharmacy: "AtPharmacy",
    dispensed: "Dispensed",
  };
  const status = map[key];
  if (!status) throw new Error(`Unknown pack status from chain: ${key}`);
  return status;
}

/** QR content: https://<vercel-url>/verify/SQ-000123 */
export function verifyUrl(baseUrl: string, serial: string): string {
  return `${baseUrl.replace(/\/$/, "")}/verify/${encodeURIComponent(serial)}`;
}
