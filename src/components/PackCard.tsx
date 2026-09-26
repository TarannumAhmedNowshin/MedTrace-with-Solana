"use client";
import type { ReactNode } from "react";
import { explorerAddress } from "@/lib/explorer";
import { fmtDate, fmtDateTime, timeAgo } from "@/lib/format";
import { verifyUrl } from "@/lib/medtrace/config";
import { nowSec } from "@/lib/medtrace/serial";
import type { Pack } from "@/lib/medtrace/types";
import { Addr, QrCode, StatusBadge, StatusStepper } from "./ui";

export function PackCard({ pack, showQr = true, footer }: { pack: Pack; showQr?: boolean; footer?: ReactNode }) {
  const expired = pack.expiry < nowSec();
  const explorer = explorerAddress(pack.address);
  return (
    <section className="card" aria-label={`Pack ${pack.serial}`}>
      <div className="pack-head">
        <div className="pack-serial">{pack.serial}</div>
        <StatusBadge status={pack.status} />
      </div>
      <StatusStepper status={pack.status} />
      <div className={`pack-body ${showQr ? "with-qr" : ""}`}>
        <dl className="kv">
          <dt>Batch</dt>
          <dd>{pack.batch}</dd>
          <dt>Expiry</dt>
          <dd>
            {fmtDate(pack.expiry)} {expired && <span className="badge badge-bad">Expired</span>}
          </dd>
          <dt>Manufacturer</dt>
          <dd><Addr value={pack.manufacturer} /></dd>
          <dt>Current holder</dt>
          <dd><Addr value={pack.holder} /></dd>
          {pack.dispensedAt && (
            <>
              <dt>Dispensed</dt>
              <dd>{fmtDateTime(pack.dispensedAt)} <span className="muted">({timeAgo(pack.dispensedAt)})</span></dd>
            </>
          )}
          <dt>Onchain</dt>
          <dd>
            {explorer ? (
              <a href={explorer} target="_blank" rel="noreferrer">Pack account ↗</a>
            ) : (
              <span className="muted">mock data</span>
            )}
          </dd>
        </dl>
        {showQr && <QrCode value={verifyUrl(pack.serial)} caption={`/verify/${pack.serial}`} />}
      </div>
      {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
    </section>
  );
}
