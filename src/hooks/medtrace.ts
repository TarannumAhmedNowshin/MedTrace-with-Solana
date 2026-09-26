"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getReader, getWriter, type MedTraceWriter } from "@/lib/medtrace/client";
import { toAppError } from "@/lib/medtrace/errors";
import { isValidSerial, normalizeSerial } from "@/lib/medtrace/serial";
import type { AppError, MintInput, Pack, PackFilter, TxResult } from "@/lib/medtrace/types";
import { useActor } from "./useActor";

export const packKeys = {
  all: ["packs"] as const,
  list: (f: PackFilter) => ["packs", f.holder ?? "*", f.status ?? "*"] as const,
  one: (serial: string) => ["pack", normalizeSerial(serial)] as const,
};

const POLL_MS = 8_000; // ≥ 5s to stay inside public RPC limits

export function usePack(serial: string | undefined) {
  const valid = !!serial && isValidSerial(serial);
  return useQuery<Pack | null, AppError>({
    queryKey: packKeys.one(serial ?? ""),
    queryFn: () => getReader().getPack(serial!),
    enabled: valid,
    refetchInterval: POLL_MS,
  });
}

export function usePacks(filter: PackFilter, opts: { enabled?: boolean } = {}) {
  return useQuery<Pack[], AppError>({
    queryKey: packKeys.list(filter),
    queryFn: () => getReader().listPacks(filter),
    enabled: opts.enabled ?? true,
    refetchInterval: POLL_MS,
  });
}

/** Shared transaction hook: normalises errors and refreshes affected queries. */
function useTx<V>(send: (w: MedTraceWriter, v: V) => Promise<TxResult>, serialOf: (v: V) => string) {
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation<TxResult, AppError, V>({
    mutationFn: async (v) => {
      try {
        return await send(getWriter(actor), v);
      } catch (e) {
        throw toAppError(e);
      }
    },
    onSettled: (_r, _e, v) => {
      qc.invalidateQueries({ queryKey: packKeys.all });
      qc.invalidateQueries({ queryKey: packKeys.one(serialOf(v)) });
    },
  });
}

export const useMint = () => useTx<MintInput>((w, v) => w.mintPack(v), (v) => v.serial);

export const useTransfer = () =>
  useTx<{ serial: string; newHolder: string }>((w, v) => w.transferCustody(v.serial, v.newHolder), (v) => v.serial);

export const useDispense = () => useTx<{ serial: string }>((w, v) => w.dispense(v.serial), (v) => v.serial);
