/**
 * The ONLY place that touches Anchor's BN / PublicKey types.
 * Everything downstream receives plain JSON-safe `Pack` objects.
 */
import type { Pack, Status } from "./types";

const STATUS_BY_KEY: Record<string, Status> = {
  manufactured: "Manufactured",
  intransit: "InTransit",
  atpharmacy: "AtPharmacy",
  dispensed: "Dispensed",
};

type BNLike = { toString(): string } | number | null | undefined;
type KeyLike = { toBase58(): string } | string;

export interface RawPack {
  serial: string;
  batch: string;
  expiry: BNLike;
  manufacturer: KeyLike;
  holder: KeyLike;
  status: Record<string, unknown>; // Anchor enum: { atPharmacy: {} }
  dispensedAt?: BNLike;
  dispensed_at?: BNLike; // tolerate snake_case IDLs
  createdAt?: BNLike;
  created_at?: BNLike;
}

const num = (v: BNLike): number => (v === null || v === undefined ? 0 : Number(v.toString()));
const key = (k: KeyLike): string => (typeof k === "string" ? k : k.toBase58());

/** Guard: a millisecond timestamp here would make every clone look GENUINE forever. */
export const toSeconds = (t: number): number => (t > 1e12 ? Math.floor(t / 1000) : t);

export function toStatus(raw: Record<string, unknown>): Status {
  const k = Object.keys(raw)[0]?.toLowerCase().replace(/_/g, "");
  const s = k ? STATUS_BY_KEY[k] : undefined;
  if (!s) throw new Error(`Unknown PackStatus variant: ${JSON.stringify(raw)}`);
  return s;
}

export function toPack(raw: RawPack, address: KeyLike): Pack {
  const dispensed = toSeconds(num(raw.dispensedAt ?? raw.dispensed_at));
  const created = toSeconds(num(raw.createdAt ?? raw.created_at));
  return {
    serial: raw.serial,
    batch: raw.batch,
    expiry: toSeconds(num(raw.expiry)),
    manufacturer: key(raw.manufacturer),
    holder: key(raw.holder),
    status: toStatus(raw.status),
    dispensedAt: dispensed > 0 ? dispensed : null,
    createdAt: created > 0 ? created : null,
    address: key(address),
  };
}
