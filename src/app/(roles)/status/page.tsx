import type { Metadata } from "next";
import { explorerAddress } from "@/lib/explorer";
import { config } from "@/lib/medtrace/config";
import { checkHealth } from "@/lib/medtrace/health";

export const metadata: Metadata = { title: "System status" };
export const dynamic = "force-dynamic";

const Yes = ({ v }: { v: boolean | null }) =>
  v === null ? <span className="badge">not checked</span> : v ? <span className="badge badge-ok">yes</span> : <span className="badge badge-bad">no</span>;

/** Pre-demo checklist: is the app really talking to the deployed program? */
export default async function StatusPage() {
  const h = await checkHealth();
  const programLink = h.programId ? explorerAddress(h.programId) : null;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>System status</h1>
          <p>Check this before the demo: every row should be green in Solana mode.</p>
        </div>
        <span className={`badge ${h.ok ? "badge-ok" : "badge-bad"}`} style={{ fontSize: 14, padding: "6px 14px" }}>
          {h.ok ? "All systems go" : `${h.problems.length} problem${h.problems.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Connection</h2>
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Data mode</dt>
            <dd>
              <span className={`badge ${h.mode === "solana" ? "badge-brand" : "badge-warn"}`}>{h.mode === "solana" ? "Solana" : "Mock data"}</span>
              <span className="muted"> (requested: {h.requestedMode})</span>
            </dd>
            <dt>Cluster</dt>
            <dd>{h.cluster}</dd>
            <dt>RPC (browser)</dt>
            <dd className="mono">{config.rpcUrl}</dd>
            <dt>Program ID</dt>
            <dd className="mono">
              {h.programId ? (programLink ? <a href={programLink} target="_blank" rel="noreferrer">{h.programId}</a> : h.programId) : "not configured"}
            </dd>
            <dt>RPC reachable</dt>
            <dd><Yes v={h.rpcReachable} /> {h.slot !== null && <span className="muted">slot {h.slot.toLocaleString()}</span>}</dd>
            <dt>Program deployed</dt>
            <dd><Yes v={h.programDeployed} /></dd>
          </dl>
        </section>

        <section className="card">
          <h2>{h.problems.length ? "Fix these" : "Ready"}</h2>
          {h.problems.length ? (
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 8 }}>
              {h.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : (
            <p className="card-sub" style={{ marginTop: 12 }}>
              {h.mode === "solana"
                ? "The app reads from and writes to the deployed MedTrace program."
                : "Running on mock data. Deploy the program and commit its IDL to switch to Solana automatically."}
            </p>
          )}
          <p className="muted" style={{ fontSize: 13, margin: "16px 0 0" }}>JSON version: <a href="/api/health">/api/health</a></p>
        </section>
      </div>
    </>
  );
}
