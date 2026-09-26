// Minimal @tanstack/react-query stand-in for the offline preview (same API surface the app uses).
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";

type Key = readonly unknown[];
interface Entry { key: Key; data?: unknown; error: unknown; status: "pending" | "success" | "error"; fetching: boolean; updatedAt: number; fn?: () => Promise<unknown>; subs: Set<() => void>; inflight?: Promise<void> }

export class QueryClient {
  private cache = new Map<string, Entry>();
  constructor(_opts?: unknown) {}
  entry(key: Key): Entry {
    const h = JSON.stringify(key);
    let e = this.cache.get(h);
    if (!e) this.cache.set(h, (e = { key, error: null, status: "pending", fetching: false, updatedAt: 0, subs: new Set() }));
    return e;
  }
  notify(e: Entry) { e.subs.forEach((s) => s()); }
  fetch(e: Entry): Promise<void> {
    if (!e.fn) return Promise.resolve();
    if (e.inflight) return e.inflight;
    e.fetching = true;
    this.notify(e);
    e.inflight = e.fn().then(
      (d) => { e.data = d; e.error = null; e.status = "success"; },
      (err) => { e.error = err; e.status = "error"; },
    ).finally(() => { e.fetching = false; e.updatedAt = Date.now(); e.inflight = undefined; this.notify(e); });
    return e.inflight;
  }
  invalidateQueries({ queryKey }: { queryKey: Key }) {
    this.cache.forEach((e) => {
      if (queryKey.every((k, i) => JSON.stringify(k) === JSON.stringify(e.key[i]))) {
        e.updatedAt = 0;
        if (e.subs.size) void this.fetch(e);
      }
    });
    return Promise.resolve();
  }
}

const Ctx = createContext<QueryClient | null>(null);
export const QueryClientProvider = ({ client, children }: { client: QueryClient; children: ReactNode }) => <Ctx.Provider value={client}>{children}</Ctx.Provider>;
export const useQueryClient = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("QueryClientProvider missing");
  return c;
};

export function useQuery<T, E = unknown>(o: { queryKey: Key; queryFn: () => Promise<T>; enabled?: boolean; refetchInterval?: number }) {
  const qc = useQueryClient();
  const enabled = o.enabled ?? true;
  const e = qc.entry(o.queryKey);
  e.fn = o.queryFn as () => Promise<unknown>;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const hash = JSON.stringify(o.queryKey);
  useEffect(() => {
    if (!enabled) return;
    e.subs.add(force);
    if (Date.now() - e.updatedAt > 3000) void qc.fetch(e);
    const id = o.refetchInterval ? setInterval(() => void qc.fetch(e), o.refetchInterval) : undefined;
    return () => { e.subs.delete(force); if (id) clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, enabled, o.refetchInterval]);
  return {
    data: (enabled ? e.data : undefined) as T | undefined,
    error: (e.error ?? null) as E | null,
    isLoading: enabled && e.status === "pending",
    isFetched: e.updatedAt > 0,
    isFetching: e.fetching,
    refetch: () => qc.fetch(e),
  };
}

type Cb<R, E, V> = { onSuccess?: (r: R, v: V) => void; onError?: (e: E, v: V) => void; onSettled?: (r: R | undefined, e: E | null, v: V) => void };

export function useMutation<R, E, V>(o: { mutationFn: (v: V) => Promise<R> } & Cb<R, E, V>) {
  const [s, set] = useState<{ status: "idle" | "pending" | "success" | "error"; data?: R; error: E | null; variables?: V }>({ status: "idle", error: null });
  const opts = useRef(o);
  opts.current = o;
  const mutateAsync = useCallback(async (v: V, cb?: Cb<R, E, V>) => {
    set({ status: "pending", error: null, variables: v });
    try {
      const r = await opts.current.mutationFn(v);
      set({ status: "success", data: r, error: null, variables: v });
      opts.current.onSuccess?.(r, v); cb?.onSuccess?.(r, v);
      opts.current.onSettled?.(r, null, v); cb?.onSettled?.(r, null, v);
      return r;
    } catch (err) {
      set({ status: "error", error: err as E, variables: v });
      opts.current.onError?.(err as E, v); cb?.onError?.(err as E, v);
      opts.current.onSettled?.(undefined, err as E, v); cb?.onSettled?.(undefined, err as E, v);
      throw err;
    }
  }, []);
  const mutate = useCallback((v: V, cb?: Cb<R, E, V>) => { mutateAsync(v, cb).catch(() => {}); }, [mutateAsync]);
  const reset = useCallback(() => set({ status: "idle", error: null }), []);
  return { ...s, mutate, mutateAsync, reset, isPending: s.status === "pending", isSuccess: s.status === "success", isError: s.status === "error" };
}
