"use client";
import Link from "next/link";
import { useState } from "react";
import { PackTable } from "@/components/PackTable";
import { usePacks } from "@/hooks/medtrace";
import { STATUS_TEXT } from "@/lib/i18n";
import { STATUSES, type Status } from "@/lib/medtrace/types";

export function RegulatorScreen() {
  const all = usePacks({});
  const [filter, setFilter] = useState<Status | "all">("all");
  const packs = all.data ?? [];
  const counts = Object.fromEntries(STATUSES.map((s) => [s, packs.filter((p) => p.status === s).length])) as Record<Status, number>;
  const shown = filter === "all" ? packs : packs.filter((p) => p.status === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Regulator view</h1>
          <p>Every registered pack and where it is right now. Read-only, straight from the chain.</p>
        </div>
      </div>

      <div className="role-grid" style={{ marginTop: 0, marginBottom: 20 }}>
        {STATUSES.map((s) => (
          <button key={s} type="button" className="role-card" style={{ textAlign: "left", cursor: "pointer", font: "inherit", borderColor: filter === s ? "var(--brand)" : undefined }}
            onClick={() => setFilter(filter === s ? "all" : s)} aria-pressed={filter === s}>
            <span>{STATUS_TEXT[s]}</span>
            <strong style={{ fontSize: 30 }}>{all.isLoading ? "…" : counts[s]}</strong>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <strong>{filter === "all" ? "All packs" : STATUS_TEXT[filter]}</strong>
        <span className="muted">({shown.length})</span>
        <span className="spacer" />
        {filter !== "all" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter("all")}>Clear filter</button>}
      </div>
      <PackTable packs={shown} loading={all.isLoading} empty="No packs match." />
      <p className="muted" style={{ fontSize: 14 }}>
        Tip: open any pack as a patient would: <Link href="/verify/SQ-000103">/verify/SQ-000103</Link>
      </p>
    </>
  );
}
