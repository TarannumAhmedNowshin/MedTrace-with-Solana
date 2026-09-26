"use client";
import { useEffect } from "react";
import { PackCard } from "@/components/PackCard";
import { PackTable } from "@/components/PackTable";
import { SerialLookup } from "@/components/SerialLookup";
import { Addr, Empty, QrCode, TxButton, TxNotice } from "@/components/ui";
import { useActor } from "@/hooks/useActor";
import { useDispense, usePack, usePacks } from "@/hooks/medtrace";
import { useSelectedSerial } from "@/hooks/useSelectedSerial";
import { fmtDateTime } from "@/lib/format";
import { verifyUrl } from "@/lib/medtrace/config";
import type { Pack } from "@/lib/medtrace/types";

function DispensePanel({ pack, me }: { pack: Pack; me?: string }) {
  const dispense = useDispense();
  useEffect(() => dispense.reset(), [pack.serial]); // eslint-disable-line react-hooks/exhaustive-deps

  const isHolder = !!me && pack.holder === me;

  if (pack.status === "Dispensed") {
    return (
      <section className="card">
        <div className="banner banner-ok" role="status">
          <strong aria-hidden>✓</strong>
          <div>
            <strong>Dispensed at {fmtDateTime(pack.dispensedAt)}.</strong> Ask the patient to scan the QR code now.
          </div>
        </div>
        <div className="row" style={{ marginTop: 16, alignItems: "flex-start" }}>
          <QrCode value={verifyUrl(pack.serial)} size={120} caption="Patient scans this" />
          <div className="stack" style={{ flex: 1, minWidth: 200 }}>
            <p className="card-sub" style={{ margin: 0 }}>
              Demo: dispensing the same pack again is rejected by the program, so a copied box can&apos;t be sold twice.
            </p>
            {isHolder && (
              <button type="button" className="btn btn-ghost" disabled={dispense.isPending}
                onClick={() => dispense.mutate({ serial: pack.serial })}>
                {dispense.isPending ? "Checking…" : "Try to dispense again"}
              </button>
            )}
          </div>
        </div>
        <TxNotice error={dispense.error} successText="" />
      </section>
    );
  }

  let guard: string | null = null;
  if (!isHolder) guard = "This pack is not in your stock.";
  else if (pack.status !== "AtPharmacy") guard = "Only packs at your pharmacy can be dispensed.";

  return (
    <section className="card">
      <h2>Dispense to patient</h2>
      <p className="card-sub">Marks the pack as sold. This can happen only once, enforced onchain.</p>
      {guard ? (
        <div className="banner banner-warn"><strong aria-hidden>!</strong><div>{guard} Holder: <Addr value={pack.holder} /></div></div>
      ) : (
        <TxButton pending={dispense.isPending} onClick={() => dispense.mutate({ serial: pack.serial })}>
          Dispense {pack.serial}
        </TxButton>
      )}
      <TxNotice result={dispense.data} error={dispense.error} successText="Dispensed." />
    </section>
  );
}

export function PharmacyScreen() {
  const actor = useActor();
  const me = actor.publicKey ?? undefined;
  const [selected, setSelected] = useSelectedSerial();
  const stock = usePacks({ holder: me, status: "AtPharmacy" }, { enabled: !!me });
  const sold = usePacks({ holder: me, status: "Dispensed" }, { enabled: !!me });
  const pack = usePack(selected);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pharmacy</h1>
          <p>Dispense verified packs to patients. Each pack can be dispensed once.</p>
        </div>
      </div>
      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <SerialLookup value={selected} onSubmit={setSelected} label="Scan or type a serial" />
          </section>
          <section className="card">
            <h2>In stock</h2>
            <p className="card-sub">Packs at your pharmacy, ready to dispense.</p>
            <PackTable packs={stock.data} loading={stock.isLoading} selected={selected} onSelect={setSelected} showHolder={false} empty="No packs in stock." />
          </section>
          <section className="card">
            <h2>Recently dispensed</h2>
            <PackTable packs={sold.data} loading={sold.isLoading} selected={selected} onSelect={setSelected} showHolder={false} empty="Nothing dispensed yet." />
          </section>
        </div>
        <div className="stack">
          {pack.data ? (
            <>
              <PackCard pack={pack.data} showQr={false} />
              <DispensePanel pack={pack.data} me={me} />
            </>
          ) : (
            <section className="card"><Empty>{selected && pack.isFetched ? `No pack ${selected}.` : "Select a pack from your stock."}</Empty></section>
          )}
        </div>
      </div>
    </>
  );
}
