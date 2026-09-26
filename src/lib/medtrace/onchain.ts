/**
 * Solana adapter: the ONLY module that imports Anchor.
 * If Playground ships a legacy IDL (no "address"), pin @coral-xyz/anchor@0.29.0 and change
 * programIdl()/new Program(...) to `new Program(idl, programId(), provider)`. Nothing else changes.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import rawIdl from "@anchor/idl/medtrace.json";
import { explorerTx } from "../explorer";
import { withVerdict, type MedTraceReader, type MedTraceWriter, type SigningWallet } from "./client";
import { toAppError } from "./errors";
import { toPack, type RawPack } from "./mapper";
import { PACK_OFFSETS, packPda, programId } from "./pda";
import { normalizeSerial } from "./serial";
import { isPublicKeyLike } from "./config";
import { AppError, STATUSES, type Pack, type TxResult } from "./types";

const COMMITMENT = "confirmed" as const;

/** IDL with the configured program ID (lets NEXT_PUBLIC_PROGRAM_ID override the IDL address). */
const programIdl = (): Idl => ({ ...(rawIdl as Idl), address: programId().toBase58() });
const B58_SINGLE_BYTE = ["1", "2", "3", "4"]; // base58([0..3]) for enum memcmp

/** Read-only reader: no wallet needed (server + /verify). */
export function createOnchainReader(rpcUrl: string): MedTraceReader {
  const connection = new Connection(rpcUrl, COMMITMENT);
  const program = new Program(programIdl(), { connection });
  const accounts = (program.account as any).pack;

  return withVerdict({
    async getPack(serial) {
      try {
        const pda = packPda(serial, program.programId);
        const raw = (await accounts.fetchNullable(pda)) as RawPack | null;
        return raw ? toPack(raw, pda) : null;
      } catch (e) {
        throw toAppError(e);
      }
    },

    async listPacks(filter = {}) {
      const filters: any[] = [];
      if (filter.holder) filters.push({ memcmp: { offset: PACK_OFFSETS.holder, bytes: filter.holder } });
      if (filter.status)
        filters.push({ memcmp: { offset: PACK_OFFSETS.status, bytes: B58_SINGLE_BYTE[STATUSES.indexOf(filter.status)] } });
      try {
        const all = (await accounts.all(filters)) as { publicKey: PublicKey; account: RawPack }[];
        return all.map((a) => toPack(a.account, a.publicKey)).sort((a: Pack, b: Pack) => a.serial.localeCompare(b.serial));
      } catch (e) {
        throw toAppError(e);
      }
    },
  });
}

/** Signing writer: Phantom signs, we send with `confirmed` commitment. */
export function createOnchainWriter(wallet: SigningWallet, rpcUrl: string): MedTraceWriter {
  const connection = new Connection(rpcUrl, COMMITMENT);
  const provider = new AnchorProvider(connection, wallet as any, { commitment: COMMITMENT });
  const program = new Program(programIdl(), provider);
  const methods = program.methods as any;
  const me = new PublicKey(wallet.publicKey.toBase58());

  const run = async (send: () => Promise<string>): Promise<TxResult> => {
    try {
      const signature = await send();
      return { signature, explorerUrl: explorerTx(signature), simulated: false };
    } catch (e) {
      throw toAppError(e);
    }
  };

  return {
    mintPack: ({ serial, batch, expiry }) =>
      run(() =>
        methods
          .mintPack(normalizeSerial(serial), batch, new BN(expiry))
          .accountsPartial({ pack: packPda(serial, program.programId), manufacturer: me })
          .rpc(),
      ),
    transferCustody: (serial, newHolder) =>
      run(() => {
        if (!isPublicKeyLike(newHolder)) throw new AppError("INVALID_ADDRESS");
        return methods
          .transferCustody(new PublicKey(newHolder))
          .accountsPartial({ pack: packPda(serial, program.programId), holder: me })
          .rpc();
      }),
    dispense: (serial) =>
      run(() =>
        methods.dispense().accountsPartial({ pack: packPda(serial, program.programId), holder: me }).rpc(),
      ),
  };
}
