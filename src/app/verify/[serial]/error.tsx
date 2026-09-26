"use client";
import { VerifyShell } from "@/components/VerifyShell";

/** Network failure must NEVER be shown as "fake". */
export default function VerifyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <VerifyShell>
      <section className="verdict verdict-warn" role="alert">
        <div className="verdict-icon" aria-hidden>↻</div>
        <p className="verdict-title">Network busy</p>
      </section>
      <section className="verdict-reason">
        <p><strong>We couldn&apos;t reach the ledger. This does not mean the medicine is fake.</strong></p>
        <p>Please try again in a moment.</p>
      </section>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={reset}>Try again</button>
    </VerifyShell>
  );
}
