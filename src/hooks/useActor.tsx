"use client";
/**
 * "Who is acting?"
 *  - mock mode   → pick a demo identity (no wallet needed; great for dev + rehearsals)
 *  - solana mode → the connected Phantom account
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import type { Actor } from "@/lib/medtrace/client";
import { config, DEMO_WALLETS, walletByKey, type DemoWallet } from "@/lib/medtrace/config";

interface ActorState extends Actor {
  mode: "mock" | "wallet";
  demo: DemoWallet | null;
  setMockActor: (publicKey: string) => void;
}

const ActorContext = createContext<ActorState | null>(null);
const STORAGE_KEY = "medtrace.mockActor";

export function ActorProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [mockKey, setMockKey] = useState<string>(DEMO_WALLETS[0]?.publicKey ?? "");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && walletByKey(saved)) setMockKey(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setMockActor = useCallback((pk: string) => {
    setMockKey(pk);
    try {
      localStorage.setItem(STORAGE_KEY, pk);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ActorState>(() => {
    if (config.mode === "mock") {
      return { mode: "mock", publicKey: mockKey, demo: walletByKey(mockKey), setMockActor };
    }
    const pk = publicKey?.toBase58() ?? null;
    return { mode: "wallet", publicKey: pk, wallet: anchorWallet ?? undefined, demo: walletByKey(pk), setMockActor };
  }, [mockKey, publicKey, anchorWallet, setMockActor]);

  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor(): ActorState {
  const ctx = useContext(ActorContext);
  if (!ctx) throw new Error("useActor must be used inside <ActorProvider>");
  return ctx;
}
