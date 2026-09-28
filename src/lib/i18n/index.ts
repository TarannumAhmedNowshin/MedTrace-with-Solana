/** UI copy (English). Kept in one place so wording stays consistent across screens. */
import type { AppErrorCode, Status, Verdict, VerdictReason } from "../medtrace/types";

export const VERDICT_TEXT: Record<Verdict, { title: string; icon: string; tone: "ok" | "warn" | "bad" }> = {
  GENUINE: { title: "Genuine medicine", icon: "✓", tone: "ok" },
  ALREADY_DISPENSED: { title: "Code already used", icon: "✕", tone: "bad" },
  OTHER_PHARMACY: { title: "Registered to another pharmacy", icon: "!", tone: "warn" },
  UNKNOWN: { title: "Not registered", icon: "✕", tone: "bad" },
};

export const REASON_TEXT: Record<VerdictReason, string> = {
  dispensedJustNow: "Dispensed to you just now by a registered pharmacy.",
  readyAtPharmacy: "Registered and held by a licensed pharmacy.",
  inSupplyChain: "Registered, still moving through the supply chain.",
  codeAlreadyUsed:
    "This code was already used. If the dispense date below matches your purchase, it's your pack. If it doesn't, this box may be a copy. Do not use it.",
  registeredElsewhere: "This pack belongs to a different pharmacy's stock.",
  notRegistered: "This code is not on the registry. This box may be fake.",
};

export const STATUS_TEXT: Record<Status, string> = {
  Manufactured: "Manufactured",
  InTransit: "In transit",
  AtPharmacy: "At pharmacy",
  Dispensed: "Dispensed",
};

export const ERROR_TEXT: Record<AppErrorCode, string> = {
  InvalidSerial: "Serial must look like SQ-000123 (A-Z, 0-9 and '-', max 32 characters).",
  InvalidBatch: "Batch is required (max 16 characters).",
  AlreadyExpired: "Expiry date must be in the future.",
  NotHolder: "This wallet does not hold the pack.",
  SameHolder: "New holder is the same as the current holder.",
  InvalidStatus: "This pack can't be transferred from its current status.",
  NotAtPharmacy: "Only packs at a pharmacy can be dispensed.",
  AlreadyDispensed: "Already dispensed: blocked onchain.",
  SerialTaken: "That serial already exists.",
  NOT_FOUND: "No pack with that serial.",
  BAD_QUERY: "Invalid request.",
  USER_REJECTED: "Transaction cancelled in the wallet.",
  DUPLICATE_TX: "Already submitted. Refreshing…",
  BLOCKHASH_EXPIRED: "Took too long to approve. Please try again.",
  WALLET_NOT_CONNECTED: "Connect a wallet first.",
  INSUFFICIENT_FUNDS: "Not enough SOL for fees. Use the airdrop button or the faucet.",
  RPC_UNAVAILABLE: "Network busy. Please retry.",
  MOCK_DISABLED: "Mock transactions are disabled while the app runs on Solana.",
  PROGRAM_NOT_CONFIGURED: "The Solana program isn't configured yet. See /status.",
  INVALID_ADDRESS: "That isn't a valid Solana address.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export const errorText = (code: string): string => ERROR_TEXT[code as AppErrorCode] ?? ERROR_TEXT.UNKNOWN;
