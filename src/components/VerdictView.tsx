/**
 * Patient verdict: pure presentational (works in Server and Client Components).
 * Meaning is carried by icon + text, never by colour alone.
 */
import { REASON_TEXT, VERDICT_TEXT } from "@/lib/i18n";
import { explorerAddress } from "@/lib/explorer";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { walletByKey } from "@/lib/medtrace/config";
import { shortAddr } from "@/lib/medtrace/serial";
import type { VerdictResult } from "@/lib/medtrace/types";

export function VerdictView({ result, serial }: { result: VerdictResult; serial: string }) {
  const v = VERDICT_TEXT[result.verdict];
  const reason = REASON_TEXT[result.reason];
  const pack = result.pack;
  const explorer = pack ? explorerAddress(pack.address) : null;
  const mfr = pack ? walletByKey(pack.manufacturer) : null;
  const holder = pack ? walletByKey(pack.holder) : null;

  return (
    <>
      <section className={`verdict verdict-${v.tone}`} role="status" aria-live="polite">
        <div className="verdict-icon" aria-hidden>{v.icon}</div>
        <p className="verdict-title">{v.title}</p>
        <span className="verdict-code">{result.verdict.replace("_", " ")} · {serial}</span>
      </section>

      <section className="verdict-reason">
        <p><strong>{reason}</strong></p>
      </section>

      {result.expired && (
        <div className="banner banner-bad" role="alert">
          <strong aria-hidden>!</strong>
          <div>This medicine is past its expiry date. Do not use it.</div>
        </div>
      )}

      {pack && (
        <section className="card">
          <h3>Pack details</h3>
          <dl className="kv">
            <dt>Serial</dt>
            <dd className="mono">{pack.serial}</dd>
            <dt>Batch</dt>
            <dd>{pack.batch}</dd>
            <dt>Expiry</dt>
            <dd>{fmtDate(pack.expiry)}</dd>
            <dt>Manufacturer</dt>
            <dd>{mfr?.label ?? shortAddr(pack.manufacturer)}</dd>
            <dt>{pack.status === "Dispensed" ? "Dispensed by" : "Held by"}</dt>
            <dd>{holder?.label ?? shortAddr(pack.holder)}</dd>
            {pack.dispensedAt && (
              <>
                <dt>Dispensed at</dt>
                <dd>{fmtDateTime(pack.dispensedAt)}</dd>
              </>
            )}
          </dl>
          {explorer && (
            <p style={{ margin: "14px 0 0" }}>
              <a href={explorer} target="_blank" rel="noreferrer">Verify on Solana Explorer ↗</a>
            </p>
          )}
        </section>
      )}
    </>
  );
}
