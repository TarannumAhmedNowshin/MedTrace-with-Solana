import type { ReactNode } from "react";
import { ActorBar, TopBar } from "@/components/AppChrome";
import { Providers } from "./providers";

/** Wallet + query providers live ONLY here, so /verify ships zero wallet code. */
export default function RolesLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <TopBar />
      <ActorBar />
      <main className="container page">{children}</main>
    </Providers>
  );
}
