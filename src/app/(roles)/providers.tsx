"use client";
// Buffer polyfill for web3.js/Anchor in the browser (Turbopack ignores webpack fallbacks).
import { Buffer } from "buffer";
if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}
import "@solana/wallet-adapter-react-ui/styles.css";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { ActorProvider } from "@/hooks/useActor";
import { config } from "@/lib/medtrace/config";
import type { AppError } from "@/lib/medtrace/types";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3_000,
            retry: (count, err) => (err as AppError)?.code !== "NOT_FOUND" && count < 2,
          },
        },
      }),
  );

  return (
    <ConnectionProvider endpoint={config.rpcUrl} config={{ commitment: "confirmed" }}>
      {/* Phantom & other Wallet Standard wallets are auto-detected: no adapters needed */}
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <ActorProvider>{children}</ActorProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
