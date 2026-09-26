"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PackCard } from "@/components/PackCard";
import { PackTable } from "@/components/PackTable";
import { TxButton, TxNotice, Empty } from "@/components/ui";
import { useActor } from "@/hooks/useActor";
import { useMint, usePack, usePacks } from "@/hooks/medtrace";
import { useSelectedSerial } from "@/hooks/useSelectedSerial";
import { isValidSerial, nextSerial, normalizeSerial } from "@/lib/medtrace/serial";

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
const defaultExpiry = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return toDateInput(d);
};

export function ManufacturerScreen() {
  const actor = useActor();
  const me = actor.publicKey ?? undefined;
  const [selected, setSelected] = useSelectedSerial();
  const all = usePacks({});
  const mine = usePacks({ holder: me }, { enabled: !!me });
  const selectedPack = usePack(selected);
  const mint = useMint();

  const suggested = useMemo(() => nextSerial((all.data ?? []).map((p) => p.serial)), [all.data]);
  const [serial, setSerial] = useState("");
  const [batch, setBatch] = useState("B-2026-09");
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [touched, setTouched] = useState(false);

  // Pre-fill the next free serial so nobody types on stage.
  useEffect(() => {
    if (!touched) setSerial(suggested);
  }, [suggested, touched]);

  const serialErr = serial && !isValidSerial(serial) ? "Use format SQ-000123 (max 32 chars)" : null;
  const batchErr = !batch ? "Required" : batch.length > 16 ? "Max 16 characters" : null;
  const expiryErr = new Date(expiry).getTime() <= Date.now() ? "Must be in the future" : null;
  const canSubmit = !!serial && !serialErr && !batchErr && !expiryErr && !!me;

  const onSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    const s = normalizeSerial(serial);
    mint.mutate(
      { serial: s, batch: batch.trim(), expiry: Math.floor(new Date(`${expiry}T23:59:59Z`).getTime() / 1000) },
      {
        onSuccess: () => {
          setSelected(s);
          setTouched(false);
        },
      },
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Manufacturer</h1>
          <p>Register a new medicine pack on Solana and print its QR code.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <form className="card" onSubmit={onSubmit} noValidate>
            <h2>Register a pack</h2>
            <p className="card-sub">Creates a Pack account onchain. You become its first holder.</p>

            <div className="field">
              <label htmlFor="serial">Serial number</label>
              <input id="serial" className="input mono" value={serial} aria-invalid={!!serialErr}
                onChange={(e) => { setTouched(true); setSerial(e.target.value.toUpperCase()); }} />
              {serialErr ? <span className="field-error">{serialErr}</span> : <span className="hint">Auto-filled with the next free serial.</span>}
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label htmlFor="batch">Batch</label>
                <input id="batch" className="input" value={batch} maxLength={16} aria-invalid={!!batchErr} onChange={(e) => setBatch(e.target.value)} />
                {batchErr && <span className="field-error">{batchErr}</span>}
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label htmlFor="expiry">Expiry</label>
                <input id="expiry" type="date" className="input" value={expiry} aria-invalid={!!expiryErr} onChange={(e) => setExpiry(e.target.value)} />
                {expiryErr && <span className="field-error">{expiryErr}</span>}
              </div>
            </div>

            <TxButton pending={mint.isPending} disabled={!canSubmit} onClick={() => onSubmit()} pendingLabel="Registering on Solana…">
              Register pack
            </TxButton>
            <TxNotice result={mint.data} error={mint.error} successText={`${mint.variables?.serial ?? "Pack"} registered.`} />
          </form>

          <section className="card">
            <h2>My inventory</h2>
            <p className="card-sub">Packs you currently hold. Select one to see its QR.</p>
            <PackTable packs={mine.data} loading={mine.isLoading} selected={selected} onSelect={setSelected} showHolder={false} empty="You don't hold any packs yet." />
          </section>
        </div>

        <div className="stack">
          {selectedPack.data ? (
            <PackCard pack={selectedPack.data} />
          ) : (
            <section className="card">
              <Empty>
                {selected && selectedPack.isFetched ? `No pack ${selected}.` : "Register a pack, or pick one from your inventory, to see its QR code here."}
              </Empty>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
