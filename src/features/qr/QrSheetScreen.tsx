"use client";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "next/navigation";
import { usePacks } from "@/hooks/medtrace";
import { fmtDate } from "@/lib/format";
import { config, verifyUrl } from "@/lib/medtrace/config";
import { normalizeSerial } from "@/lib/medtrace/serial";
import { Empty } from "@/components/ui";

/** Printable QR labels. Print only AFTER the final Vercel URL is set: it's baked into every code. */
export function QrSheetScreen() {
  const params = useSearchParams();
  const only = params?.get("serial");
  const all = usePacks({});
  const packs = (all.data ?? []).filter((p) => !only || p.serial === normalizeSerial(only));
  const extra = only ? [] : ["SQ-999999"]; // unregistered code for the "fake" demo

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>QR labels</h1>
          <p>
            Codes point to <span className="mono">{config.appUrl}/verify/…</span>. Print a genuine box, a photocopy (the clone), and SQ-999999 (the fake).
          </p>
        </div>
        <button type="button" className="btn btn-primary qr-print-btn" onClick={() => window.print()}>Print labels</button>
      </div>
      {!all.isLoading && packs.length === 0 && <Empty>No packs to print.</Empty>}
      <div className="qr-sheet">
        {packs.map((p) => (
          <div className="qr-tile" key={p.serial}>
            <QRCodeSVG value={verifyUrl(p.serial)} size={150} level="M" marginSize={0} />
            <div className="serial">{p.serial}</div>
            <div className="meta">Batch {p.batch} · Exp {fmtDate(p.expiry)}</div>
            <div className="meta">Scan to verify</div>
          </div>
        ))}
        {extra.map((s) => (
          <div className="qr-tile" key={s}>
            <QRCodeSVG value={verifyUrl(s)} size={150} level="M" marginSize={0} />
            <div className="serial">{s}</div>
            <div className="meta">Unregistered code (demo fake)</div>
          </div>
        ))}
      </div>
    </>
  );
}
