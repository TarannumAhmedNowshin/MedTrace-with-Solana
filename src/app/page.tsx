import Link from "next/link";
import { TopBar } from "@/components/AppChrome";

const ROLES = [
  { n: 1, href: "/manufacturer", title: "Manufacturer", body: "Register each pack onchain and print its QR code." },
  { n: 2, href: "/distributor", title: "Distributor", body: "Take custody and hand packs to pharmacies, with every step signed." },
  { n: 3, href: "/pharmacy", title: "Pharmacy", body: "Dispense to the patient. Each pack can be dispensed only once." },
  { n: 4, href: "/verify", title: "Patient", body: "Scan the box with a phone camera and see Genuine, or a clear warning." },
];

const DEMO = [
  { serial: "SQ-000102", label: "Genuine, just dispensed", tone: "badge-ok" },
  { serial: "SQ-000103", label: "Clone: already dispensed", tone: "badge-bad" },
  { serial: "SQ-999999", label: "Fake: not registered", tone: "badge-bad" },
  { serial: "SQ-000101", label: "At pharmacy", tone: "badge-brand" },
];

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="container page">
        <section className="hero">
          <span className="badge badge-brand">Built on Solana</span>
          <h1 style={{ marginTop: 14 }}>Every medicine pack, traceable from factory to patient.</h1>
          <p>
            MedTrace records each pack on Solana. A copied QR code can&apos;t pass as genuine: once a pack is dispensed,
            every later scan of that code shows a warning.
          </p>
        </section>

        <div className="role-grid">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="role-card">
              <span className="role-num">{r.n}</span>
              <strong>{r.title}</strong>
              <span>{r.body}</span>
            </Link>
          ))}
        </div>

        <section className="card" style={{ marginTop: 28 }}>
          <h2>Try a scan</h2>
          <p className="card-sub">Open these the way a patient&apos;s phone would.</p>
          <div className="row">
            {DEMO.map((d) => (
              <Link key={d.serial} href={`/verify/${d.serial}`} className={`badge ${d.tone}`} style={{ padding: "8px 12px", fontSize: 13 }}>
                <span className="mono">{d.serial}</span> · {d.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
