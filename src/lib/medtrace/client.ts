/**
 * MedTraceClient: the ONLY data interface the UI knows about.
 *
 *   Reads  (browser) → REST API  (/api/packs/*, or an external backend via NEXT_PUBLIC_API_BASE)
 *   Reads  (server)  → serverReader(): mock store | MedTrace program on Solana (see server.ts)
 *   Writes (browser) → mock: POST /api/mock/tx/*   |   solana: Phantom signs → MedTrace program
 *
 * Swapping the backend never touches a screen, only this layer.
 */
import type { Transaction, VersionedTransaction } from "@solana/web3.js"; // type-only: erased at build
import { config } from "./config";
import { computeVerdict, type VerdictContext } from "./verdict";
import { nowSec } from "./serial";
import { AppError, type MintInput, type Pack, type PackFilter, type TxResult, type VerdictResult } from "./types";

export interface MedTraceReader {
  getPack(serial: string): Promise<Pack | null>;
  listPacks(filter?: PackFilter): Promise<Pack[]>;
  getVerdict(serial: string, ctx?: VerdictContext): Promise<VerdictResult>;
}

export interface MedTraceWriter {
  mintPack(input: MintInput): Promise<TxResult>;
  transferCustody(serial: string, newHolder: string): Promise<TxResult>;
  dispense(serial: string): Promise<TxResult>;
}

/** Adds getVerdict to any pack source, so the rules live in exactly one place. */
export function withVerdict(src: Omit<MedTraceReader, "getVerdict">): MedTraceReader {
  return {
    ...src,
    async getVerdict(serial, ctx) {
      return computeVerdict(await src.getPack(serial), nowSec(), ctx);
    },
  };
}

/** Minimal wallet shape we need for signing (matches wallet-adapter's AnchorWallet). */
export interface SigningWallet {
  publicKey: { toBase58(): string };
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export interface Actor {
  publicKey: string | null;
  wallet?: SigningWallet; // present in wallet mode once Phantom is connected
}

// ─── Browser factories ────────────────────────────────────────────────

let reader: MedTraceReader | null = null;

export async function loadHttp() {
  return import("./http");
}

export function getReader(): MedTraceReader {
  if (!reader) {
    // lazily bound so the module graph stays light
    reader = {
      getPack: async (s) => (await loadHttp()).createHttpReader(config.apiBase).getPack(s),
      listPacks: async (f) => (await loadHttp()).createHttpReader(config.apiBase).listPacks(f),
      getVerdict: async (s, c) => (await loadHttp()).createHttpReader(config.apiBase).getVerdict(s, c),
    };
  }
  return reader;
}

export function getWriter(actor: Actor): MedTraceWriter {
  if (!actor.publicKey) throw new AppError("WALLET_NOT_CONNECTED");

  if (config.mode === "mock") {
    const signer = actor.publicKey;
    return {
      mintPack: async (i) => (await loadHttp()).createMockTxWriter(config.apiBase, signer).mintPack(i),
      transferCustody: async (s, h) => (await loadHttp()).createMockTxWriter(config.apiBase, signer).transferCustody(s, h),
      dispense: async (s) => (await loadHttp()).createMockTxWriter(config.apiBase, signer).dispense(s),
    };
  }

  const wallet = actor.wallet;
  if (!wallet) throw new AppError("WALLET_NOT_CONNECTED");
  // Anchor + web3.js are only loaded when a real transaction is sent.
  const w = async () => (await import("./onchain")).createOnchainWriter(wallet, config.rpcUrl);
  return {
    mintPack: async (i) => (await w()).mintPack(i),
    transferCustody: async (s, h) => (await w()).transferCustody(s, h),
    dispense: async (s) => (await w()).dispense(s),
  };
}
