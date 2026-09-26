// Offline, in-browser preview of the MedTrace frontend.
// Renders the REAL screens/components from src/ with shims for Next.js, wallet-adapter and the API.
import { createRoot } from "react-dom/client";
import { useEffect, useState, type ReactNode } from "react";
import { HashRouter, useRouterState } from "./shims/router";
import { previewStore } from "./shims/http";

import Home from "../src/app/page";
import RolesLayout from "../src/app/(roles)/layout";
import ManufacturerPage from "../src/app/(roles)/manufacturer/page";
import DistributorPage from "../src/app/(roles)/distributor/page";
import PharmacyPage from "../src/app/(roles)/pharmacy/page";
import RegulatorPage from "../src/app/(roles)/regulator/page";
import QrPage from "../src/app/(roles)/qr/page";
import StatusPage from "../src/app/(roles)/status/page";
import VerifyIndex from "../src/app/verify/page";
import Loading from "../src/app/verify/[serial]/loading";
import { RecheckButton } from "../src/app/verify/[serial]/RecheckButton";
import { VerdictView } from "../src/components/VerdictView";
import { VerifyShell } from "../src/components/VerifyShell";
import { getReader } from "../src/lib/medtrace/client";
import { normalizeSerial } from "../src/lib/medtrace/serial";
import type { VerdictResult } from "../src/lib/medtrace/types";

/** Client-side stand-in for the async Server Component at app/verify/[serial]/page.tsx */
function VerifySerial({ serial }: { serial: string }) {
  const { refreshKey, search } = useRouterState();
  const [result, setResult] = useState<VerdictResult | null>(null);
  const pharmacy = search.get("pharmacy") ?? undefined;
  useEffect(() => {
    let alive = true;
    getReader().getVerdict(serial, { pharmacy }).then((r) => alive && setResult(r));
    return () => { alive = false; };
  }, [serial, pharmacy, refreshKey]);
  if (!result) return <Loading />;
  return (
    <VerifyShell>
      <VerdictView result={result} serial={serial} />
      <RecheckButton />
    </VerifyShell>
  );
}

/** Renders an async Server Component page on the client (preview only). */
function AsyncPage({ load }: { load: () => Promise<ReactNode> }) {
  const [el, setEl] = useState<ReactNode>(null);
  useEffect(() => { load().then(setEl); }, [load]);
  return <>{el}</>;
}
const StatusRoute = () => <AsyncPage load={StatusPage} />;

const ROLE_PAGES: Record<string, () => ReactNode> = {
  "/manufacturer": ManufacturerPage,
  "/distributor": DistributorPage,
  "/pharmacy": PharmacyPage,
  "/regulator": RegulatorPage,
  "/qr": QrPage,
  "/status": StatusRoute,
};

function Routes() {
  const { path } = useRouterState();
  if (path === "/") return <Home />;
  if (path === "/verify") return <VerifyIndex />;
  const m = /^\/verify\/(.+)$/.exec(path);
  if (m) return <VerifySerial key={m[1]} serial={normalizeSerial(m[1])} />;
  const Page = ROLE_PAGES[path];
  if (Page) return <RolesLayout><Page /></RolesLayout>;
  return <Home />;
}

function PreviewBar() {
  const { nav } = useRouterState();
  return (
    <div className="preview-bar">
      <span><strong>Interactive preview</strong> · mock data, no wallet needed. Use “Acting as” to switch roles.</span>
      <span className="spacer" />
      <button type="button" onClick={() => { previewStore.reset(); nav("/"); location.reload(); }}>Reset demo data</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <PreviewBar />
    <Routes />
  </HashRouter>,
);
