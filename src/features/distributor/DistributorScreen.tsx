"use client";
import { useEffect, useMemo, useState } from "react";
import { PackCard } from "@/components/PackCard";
import { PackTable } from "@/components/PackTable";
import { SerialLookup } from "@/components/SerialLookup";
import { Addr, Empty, TxButton, TxNotice } from "@/components/ui";
import { useActor } from "@/hooks/useActor";
import { usePack, usePacks, useTransfer } from "@/hooks/medtrace";
import { useSelectedSerial } from "@/hooks/useSelectedSerial";
import { DEMO_WALLETS, isPublicKeyLike } from "@/lib/medtrace/config";
import type { Pack } from "@/lib/medtrace/types";

const ROLE_ORDER = { manufacturer: 0, distributor: 1, pharmacy: 2, regulator: 3 } as const;

/** Who should receive this pack next? Suggest the natural next role. */
function suggestedRole(p: Pack) {
  return p.status === "Manufactured" ? "distributor" : "pharmacy";
}

export function TransferPanel({ pack, me }: { pack: Pack; me?: string }) {
  const transfer = useTransfer();
  const options = useMemo(
    () => DEMO_WALLETS.filter((w) => w.publicKey !== pack.holder && w.role !== "regulator" && w.role !== "manufacturer")
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
    [pack.holder],
  );
  const [to, setTo] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    const pick = options.find((w) => w.role === suggestedRole(pack)) ?? options[0];
    setTo(pick?.publicKey ?? "__custom");
    transfer.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.serial, pack.status]);

  const isHolder = !!me && pack.holder === me;
  const canMove = pack.status === "Manufactured" || pack.status === "InTransit";
  const target = to === "__custom" ? custom.trim() : to;
  const customInvalid = to === "__custom" && !!custom.trim() && !isPublicKeyLike(custom.trim());

  let guard: string | null = null;
  if (!isHolder) guard = "You are not the current holder of this pack.";
  else if (!canMove) guard = pack.status === "Dispensed" ? "This pack was already dispensed." : "Packs at a pharmacy can only be dispensed.";

  return (
    <section className="card">
      <h2>Transfer custody</h2>
      <p className="card-sub">
        {pack.status === "Manufactured" ? "Next hop: distributor (status → In transit)." : "Next hop: pharmacy (status → At pharmacy)."}
      </p>
      {guard ? (
        <div className="banner banner-warn"><strong aria-hidden>!</strong><div>{guard} Holder: <Addr value={pack.holder} /></div></div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="to">Send to</label>
            <select id="to" className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              {options.map((w) => (
                <option key={w.publicKey} value={w.publicKey}>
                  {w.role === "pharmacy" ? "Pharmacy" : "Distributor"}: {w.label}
                </option>
              ))}
              <option value="__custom">Other address…</option>
            </select>
          </div>
          {to === "__custom" && (
            <div className="field">
              <label htmlFor="custom">Wallet address</label>
              <input id="custom" className="input mono" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Base58 public key" aria-invalid={customInvalid} />
              {customInvalid && <span className="field-error">That isn&apos;t a valid Solana address.</span>}
            </div>
          )}
          <TxButton pending={transfer.isPending} disabled={!target || customInvalid} onClick={() => transfer.mutate({ serial: pack.serial, newHolder: target })}>
            Transfer {pack.serial}
          </TxButton>
        </>
      )}
      <TxNotice result={transfer.data} error={transfer.error} successText="Custody transferred." />
    </section>
  );
}

export function DistributorScreen() {
  const actor = useActor();
  const me = actor.publicKey ?? undefined;
  const [selected, setSelected] = useSelectedSerial();
  const held = usePacks({ holder: me }, { enabled: !!me });
  const pack = usePack(selected);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Distributor</h1>
          <p>Receive packs from the manufacturer and hand them to pharmacies. Every handover is signed.</p>
        </div>
      </div>
      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <SerialLookup value={selected} onSubmit={setSelected} />
          </section>
          <section className="card">
            <h2>Packs I hold</h2>
            <p className="card-sub">Select a pack to transfer it.</p>
            <PackTable packs={held.data} loading={held.isLoading} selected={selected} onSelect={setSelected} showHolder={false} empty="Nothing in your custody." />
          </section>
        </div>
        <div className="stack">
          {pack.data ? (
            <>
              <PackCard pack={pack.data} showQr={false} />
              <TransferPanel pack={pack.data} me={me} />
            </>
          ) : (
            <section className="card"><Empty>{selected && pack.isFetched ? `No pack ${selected}.` : "Select or look up a pack."}</Empty></section>
          )}
        </div>
      </div>
    </>
  );
}
