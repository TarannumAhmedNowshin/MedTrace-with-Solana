import { PublicKey } from "@solana/web3.js";
import { config } from "./config";
import { MAX_SEED_BYTES, normalizeSerial } from "./serial";
import { AppError } from "./types";

/** Resolved lazily so mock mode never constructs a PublicKey from a placeholder ID. */
export function programId(): PublicKey {
  if (!config.programId) {
    throw new AppError("PROGRAM_NOT_CONFIGURED", "Set NEXT_PUBLIC_PROGRAM_ID or commit the deployed IDL", 503);
  }
  return new PublicKey(config.programId);
}

const enc = new TextEncoder();

/** Pack PDA: seeds = ["pack", serial_utf8] (Tech Design §3.1, program PACK_SEED). */
export function packPda(serial: string, pid: PublicKey = programId()): PublicKey {
  const s = normalizeSerial(serial);
  const bytes = enc.encode(s);
  if (bytes.length === 0 || bytes.length > MAX_SEED_BYTES) throw new AppError("InvalidSerial");
  return PublicKey.findProgramAddressSync([enc.encode("pack"), bytes], pid)[0];
}

/** Byte offsets of fixed fields in the Pack account (fixed fields first, strings last). */
export const PACK_OFFSETS = { manufacturer: 8, holder: 40, status: 72 } as const;
