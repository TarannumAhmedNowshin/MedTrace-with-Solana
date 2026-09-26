"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useActor } from "@/hooks/useActor";
import { explorerAddress } from "@/lib/explorer";
import { config, DEMO_WALLETS } from "@/lib/medtrace/config";
import { shortAddr } from "@/lib/medtrace/serial";
import type { Role } from "@/lib/medtrace/types";

// Wallet button renders differently on server vs client → client-only to avoid hydration errors.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

const NAV: { href: string; label: string; role?: Role }[] = [
  { href: "/manufacturer", label: "1 · Manufacturer", role: "manufacturer" },
  { href: "/distributor", label: "2 · Distributor", role: "distributor" },
  { href: "/pharmacy", label: "3 · Pharmacy", role: "pharmacy" },
  { href: "/verify", label: "4 · Patient verify" },
  { href: "/regulator", label: "Regulator", role: "regulator" },
  { href: "/qr", label: "QR sheet" },
  { href: "/status", label: "Status" },
];

const ROLE_LABEL: Record<Role, string> = {
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  pharmacy: "Pharmacy",
  regulator: "Regulator",
};

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand" aria-label="MedTrace home">
          <span className="brand-mark" aria-hidden>✚</span> MedTrace
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname?.startsWith(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** SOL balance + one-click devnet/localnet airdrop so demo wallets never run dry. */
function Balance({ publicKey }: { publicKey: string }) {
  const { connection } = useConnection();
  const [sol, setSol] = useState<number | null>(null);
  const [airdrop, setAirdrop] = useState<"idle" | "pending" | "failed">("idle");

  const load = useCallback(
    () =>
      connection
        .getBalance(new PublicKey(publicKey))
        .then((l) => setSol(l / LAMPORTS_PER_SOL))
        .catch(() => setSol(null)),
    [connection, publicKey],
  );

  useEffect(() => {
    void load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const requestAirdrop = async () => {
    setAirdrop("pending");
    try {
      const sig = await connection.requestAirdrop(new PublicKey(publicKey), 1 * LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      setAirdrop("idle");
      void load();
    } catch {
      setAirdrop("failed"); // public devnet faucet is rate-limited → offer the web faucet
    }
  };

  const low = sol !== null && sol < 0.05;
  return (
    <>
      {sol !== null && <span className={`badge ${low ? "badge-bad" : ""}`}>{sol.toFixed(3)} SOL</span>}
      {config.canAirdrop && (low || airdrop !== "idle") && (
        airdrop === "failed" ? (
          <a className="badge badge-bad" href="https://faucet.solana.com" target="_blank" rel="noreferrer">Airdrop limited: use faucet ↗</a>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={requestAirdrop} disabled={airdrop === "pending"}>
            {airdrop === "pending" ? "Requesting…" : "Get 1 test SOL"}
          </button>
        )
      )}
    </>
  );
}

/** Who am I acting as, on which network, and does it match this screen? */
export function ActorBar() {
  const actor = useActor();
  const pathname = usePathname() ?? "";
  const expected = NAV.find((n) => pathname.startsWith(n.href))?.role;
  const mismatch = expected && expected !== "regulator" && actor.demo && actor.demo.role !== expected;
  const programLink = config.programId ? explorerAddress(config.programId) : null;

  return (
    <div className="actorbar">
      <div className="container actorbar-inner">
        {config.mode === "mock" ? (
          <Link href="/status" className="badge badge-warn" title="Running on mock data. See status for how to switch to Solana.">Mock data</Link>
        ) : (
          <a className="badge badge-brand" href={programLink ?? "#"} target="_blank" rel="noreferrer" title={`Program ${config.programId}`}>
            <span className="dot" aria-hidden /> Solana {config.cluster} · {shortAddr(config.programId ?? "", 4)}
          </a>
        )}

        {actor.mode === "mock" ? (
          <label className="row" style={{ gap: 8 }}>
            <span className="muted">Acting as</span>
            <select id="acting-as" className="select" style={{ minHeight: 36, width: "auto", padding: "4px 10px" }} value={actor.publicKey ?? ""} onChange={(e) => actor.setMockActor(e.target.value)}>
              {DEMO_WALLETS.map((w) => (
                <option key={w.publicKey} value={w.publicKey}>
                  {ROLE_LABEL[w.role]}: {w.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <WalletMultiButton />
            {actor.publicKey && <Balance publicKey={actor.publicKey} />}
          </>
        )}

        {actor.demo && <span className="badge badge-brand">{ROLE_LABEL[actor.demo.role]}</span>}
        {actor.mode === "wallet" && actor.publicKey && !actor.demo && (
          <span className="badge" title="Add it to NEXT_PUBLIC_DEMO_WALLETS to label it">Unlisted wallet</span>
        )}

        <span className="spacer" />
        {mismatch && expected && (
          <span className="badge badge-warn" role="status" style={{ whiteSpace: "normal" }}>
            This is the {ROLE_LABEL[expected]} screen. Switch {actor.mode === "mock" ? "identity" : "Phantom account"} to act as {ROLE_LABEL[expected]}.
          </span>
        )}
      </div>
    </div>
  );
}
