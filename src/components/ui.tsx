"use client";
import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { errorText, STATUS_TEXT } from "@/lib/i18n";
import { walletByKey } from "@/lib/medtrace/config";
import { shortAddr } from "@/lib/medtrace/serial";
import { STATUSES, type AppError, type Status, type TxResult } from "@/lib/medtrace/types";

/* ─── Address label: demo wallet name if known, else short base58 ───── */
export function Addr({ value }: { value: string }) {
  const w = walletByKey(value);
  return (
    <span title={value}>
      {w ? w.label : <span className="mono">{shortAddr(value)}</span>}
    </span>
  );
}

/* ─── Status badge + stepper ────────────────────────────────────────── */
const STATUS_TONE: Record<Status, string> = {
  Manufactured: "badge",
  InTransit: "badge badge-warn",
  AtPharmacy: "badge badge-brand",
  Dispensed: "badge badge-ok",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={STATUS_TONE[status]}>
      <span className="dot" aria-hidden /> {STATUS_TEXT[status]}
    </span>
  );
}

export function StatusStepper({ status }: { status: Status }) {
  const idx = STATUSES.indexOf(status);
  return (
    <ol className="stepper" aria-label={`Status: ${STATUS_TEXT[status]}`}>
      {STATUSES.map((s, i) => (
        <li key={s} className={`step ${i <= idx ? "done" : ""} ${i === idx ? "current" : ""}`} aria-current={i === idx ? "step" : undefined}>
          <span className="step-bar" />
          {STATUS_TEXT[s]}
        </li>
      ))}
    </ol>
  );
}

/* ─── QR code ───────────────────────────────────────────────────────── */
export function QrCode({ value, size = 140, caption }: { value: string; size?: number; caption?: string }) {
  return (
    <div className="qr-box">
      <QRCodeSVG value={value} size={size} level="M" marginSize={0} aria-label={`QR code for ${value}`} />
      {caption && <small>{caption}</small>}
    </div>
  );
}

/* ─── Transaction button (idle → pending → done/error) ──────────────── */
export function TxButton({
  pending,
  disabled,
  onClick,
  children,
  variant = "primary",
  pendingLabel,
}: {
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "danger";
  pendingLabel?: string;
}) {
  return (
    <button type="button" className={`btn btn-lg btn-block btn-${variant}`} disabled={pending || disabled} onClick={onClick} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden /> {pendingLabel ?? "Confirming on Solana…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* ─── Tx outcome ────────────────────────────────────────────────────── */
export function TxNotice({ result, error, successText }: { result?: TxResult; error?: AppError | null; successText: string }) {
  if (error) {
    const t = errorText(error.code);
    return (
      <div className="banner banner-bad tx" role="alert">
        <strong aria-hidden>✕</strong>
        <div>
          {t}
          <div className="mono muted" style={{ fontSize: 12 }}>{error.code}</div>
        </div>
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="banner banner-ok tx" role="status">
      <strong aria-hidden>✓</strong>
      <div>
        {successText}{" "}
        {result.explorerUrl ? (
          <a href={result.explorerUrl} target="_blank" rel="noreferrer">View on Solana Explorer ↗</a>
        ) : (
          <span className="mono" style={{ fontSize: 12 }}>(simulated tx · {shortAddr(result.signature, 6)})</span>
        )}
      </div>
    </div>
  );
}

/* ─── Misc ──────────────────────────────────────────────────────────── */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Skeleton({ h = 20, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden />;
}
