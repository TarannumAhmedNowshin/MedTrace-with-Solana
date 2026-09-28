/**
 * App configuration: ONE switch decides how the whole app talks to data.
 *
 *   NEXT_PUBLIC_MEDTRACE_MODE = auto | solana | mock      (default: auto)
 *     solana → reads from the MedTrace program on Solana, writes are signed in Phantom
 *     mock   → in-memory demo data with the same rules as the program (no wallet needed)
 *     auto   → solana if a real program ID is configured, otherwise mock
 *
 * NEXT_PUBLIC_* values are inlined at build time, so redeploy after changing them.
 */
import idl from "@anchor/idl/medtrace.json";
import type { Role } from "./types";

export type Cluster = "devnet" | "localnet" | "mainnet-beta" | "testnet";
export type DataMode = "solana" | "mock";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const BASE58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isPublicKeyLike = (s: string | null | undefined): s is string => !!s && BASE58_KEY.test(s);

const cluster = ((process.env.NEXT_PUBLIC_CLUSTER || "").trim() || "devnet") as Cluster; // empty env var → devnet

const DEFAULT_RPC: Record<Cluster, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

/** Program ID: explicit env override, else the IDL's `address` (Anchor ≥ 0.30 IDLs). */
const programId = (process.env.NEXT_PUBLIC_PROGRAM_ID || (idl as { address?: string }).address || "").trim();
export const programConfigured = isPublicKeyLike(programId) && programId !== SYSTEM_PROGRAM;

const requested = ((process.env.NEXT_PUBLIC_MEDTRACE_MODE || "").trim() || "auto").toLowerCase();
const mode: DataMode =
  requested === "mock" ? "mock" : requested === "solana" ? "solana" : programConfigured ? "solana" : "mock";

export const config = {
  mode,
  requestedMode: requested,
  cluster,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC[cluster] || DEFAULT_RPC.devnet,
  programId: programConfigured ? programId : null,
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? "",
  /** Faucet button is shown on test clusters only. */
  canAirdrop: cluster === "devnet" || cluster === "localnet" || cluster === "testnet",
} as const;

// ─── Demo identities ─────────────────────────────────────────────────────────

export interface DemoWallet {
  role: Role;
  label: string;
  publicKey: string;
}

/** Fictional placeholder identities used in mock mode. */
export const MOCK_KEYS = {
  manufacturer: "MfrDemo1111111111111111111111111111111111111",
  distributor: "DistDemo111111111111111111111111111111111111",
  pharmacy: "PharmDemo11111111111111111111111111111111111",
  otherPharmacy: "PharmOther1111111111111111111111111111111111",
  regulator: "RegDemo1111111111111111111111111111111111111",
};

/**
 * Real wallets for solana mode: paste the line `npm run seed` prints, e.g.
 * NEXT_PUBLIC_DEMO_WALLETS={"manufacturer":"...","distributor":"...","pharmacy":"...","otherPharmacy":"..."}
 * Public keys only, never secrets.
 */
function realKeys(): Partial<typeof MOCK_KEYS> {
  try {
    const parsed = JSON.parse(process.env.NEXT_PUBLIC_DEMO_WALLETS || "{}") as Record<string, string>;
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isPublicKeyLike(v)));
  } catch {
    return {};
  }
}

// Solana mode only lists real, configured wallets (fake mock keys would fail on-chain).
const keys: Partial<typeof MOCK_KEYS> = mode === "solana" ? realKeys() : MOCK_KEYS;

export const DEMO_WALLETS: DemoWallet[] = (
  [
    { role: "manufacturer", label: "Padma Pharmaceuticals (demo)", publicKey: keys.manufacturer },
    { role: "distributor", label: "Dhaka Distribution (demo)", publicKey: keys.distributor },
    { role: "pharmacy", label: "Dhanmondi Care Pharmacy (demo)", publicKey: keys.pharmacy },
    { role: "pharmacy", label: "Mirpur Health Pharmacy (demo)", publicKey: keys.otherPharmacy },
    { role: "regulator", label: "Drug Regulator (demo)", publicKey: keys.regulator },
  ] as { role: Role; label: string; publicKey?: string }[]
).filter((w): w is DemoWallet => !!w.publicKey);

export const walletByKey = (pk: string | null | undefined) => DEMO_WALLETS.find((w) => w.publicKey === pk) ?? null;
export const walletsByRole = (role: Role) => DEMO_WALLETS.filter((w) => w.role === role);

/**
 * Manufacturers whose packs can be GENUINE. The program lets any wallet mint, so the verdict
 * checks pack.manufacturer against this list. Set explicitly for real deployments:
 * NEXT_PUBLIC_KNOWN_MANUFACTURERS=["<base58>", ...]
 * Default: the demo manufacturer wallet(s). Empty → check disabled (see /status).
 */
function knownManufacturers(): string[] {
  try {
    const parsed = JSON.parse(process.env.NEXT_PUBLIC_KNOWN_MANUFACTURERS || "[]") as unknown;
    const fromEnv = Array.isArray(parsed) ? parsed.filter((k): k is string => isPublicKeyLike(k)) : [];
    if (fromEnv.length) return fromEnv;
  } catch {
    /* fall through to demo wallets */
  }
  return walletsByRole("manufacturer").map((w) => w.publicKey);
}

export const KNOWN_MANUFACTURERS: readonly string[] = knownManufacturers();

export const verifyUrl = (serial: string) => `${config.appUrl}/verify/${encodeURIComponent(serial)}`;
