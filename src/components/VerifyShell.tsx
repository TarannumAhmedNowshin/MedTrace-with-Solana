import Link from "next/link";
import type { ReactNode } from "react";
import { config } from "@/lib/medtrace/config";

/** Minimal, phone-first frame for the patient pages (no wallet, no nav). */
export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div className="verify-shell">
      <header className="verify-top">
        <Link href="/verify" className="brand" aria-label="MedTrace verify">
          <span className="brand-mark" aria-hidden>✚</span> MedTrace
        </Link>
        {config.mode === "solana" ? (
          <span className="badge badge-brand">Checked on Solana {config.cluster}</span>
        ) : (
          <span className="badge badge-warn">Demo data</span>
        )}
      </header>
      <main className="verify-main">{children}</main>
      <footer className="verify-foot">
        {config.mode === "solana" ? "Checked live against the public Solana ledger." : "Demo mode: sample data, not yet on Solana."}
      </footer>
    </div>
  );
}
