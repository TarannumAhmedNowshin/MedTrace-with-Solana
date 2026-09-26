import { VerifyShell } from "@/components/VerifyShell";

export default function Loading() {
  return (
    <VerifyShell>
      <div className="skeleton" style={{ height: 260, borderRadius: 22 }} aria-label="Checking the ledger…" />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 180 }} />
    </VerifyShell>
  );
}
