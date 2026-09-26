/**
 * MedTrace shared contract (frozen at 10:30, see Tech Design §4.2).
 * JSON-safe DTOs only: no BN, no PublicKey. Timestamps are unix SECONDS.
 */

export const STATUSES = ["Manufactured", "InTransit", "AtPharmacy", "Dispensed"] as const;
export type Status = (typeof STATUSES)[number];

export type Verdict = "GENUINE" | "OTHER_PHARMACY" | "ALREADY_DISPENSED" | "UNKNOWN";

export type Role = "manufacturer" | "distributor" | "pharmacy" | "regulator";

export interface Pack {
  serial: string; // "SQ-000123"
  batch: string; // "B-2026-09"
  expiry: number; // unix seconds
  manufacturer: string; // base58
  holder: string; // base58
  status: Status;
  dispensedAt: number | null; // unix seconds
  createdAt: number | null; // unix seconds
  address: string; // Pack PDA (base58), or "mock:<serial>" in mock mode
}

export type VerdictReason =
  | "notRegistered"
  | "dispensedJustNow"
  | "codeAlreadyUsed"
  | "registeredElsewhere"
  | "readyAtPharmacy"
  | "inSupplyChain";

export interface VerdictResult {
  verdict: Verdict;
  reason: VerdictReason;
  expired: boolean;
  pack: Pack | null;
  checkedAt: number; // unix seconds
}

export interface MintInput {
  serial: string;
  batch: string;
  expiry: number; // unix seconds
}

export interface TxResult {
  signature: string;
  explorerUrl: string | null; // null for simulated (mock) transactions
  simulated: boolean;
}

export interface PackFilter {
  holder?: string;
  status?: Status;
}

/** Stable error codes shared by program (Anchor names), mock and API. */
export type AppErrorCode =
  | "InvalidSerial"
  | "InvalidBatch"
  | "AlreadyExpired"
  | "NotHolder"
  | "SameHolder"
  | "InvalidStatus"
  | "NotAtPharmacy"
  | "AlreadyDispensed"
  | "SerialTaken"
  | "NOT_FOUND"
  | "BAD_QUERY"
  | "USER_REJECTED"
  | "DUPLICATE_TX"
  | "BLOCKHASH_EXPIRED"
  | "WALLET_NOT_CONNECTED"
  | "INSUFFICIENT_FUNDS"
  | "RPC_UNAVAILABLE"
  | "MOCK_DISABLED"
  | "PROGRAM_NOT_CONFIGURED"
  | "INVALID_ADDRESS"
  | "UNKNOWN";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message?: string,
    public readonly status = 400,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}
