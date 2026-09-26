# MedTrace: Frontend Plan

*Build IRL Vol. 1 · Solana Hackathon · Dogpatch Labs, Dublin · Sat 26 Sep 2026 · 10:00–18:00*
*Owners: **P2** (client library + role screens), **P3** (verify page, QR codes, Vercel, demo)*
*Reviewed by the Frontend Lead (the stack and version choices were checked on 26 Sep 2026)*

---

## 0. TL;DR

- **Stack:** Next.js 16 (App Router) + `@solana/web3.js` v1 + Anchor TS client + wallet-adapter + TanStack Query, deployed on Vercel. We chose it because it's reliable and well documented, not because it's new.
- **The UI never talks to Anchor directly.** Every screen goes through one `MedTraceClient` interface, which has three swappable implementations: **`mock` → `onchain` → `http`**. You switch between them with one env var. That's what makes the backend pluggable: a future indexer or API replaces `http` without any UI changes.
- **`/verify/[serial]` is a Server Component.** It reads the chain on the server, so the phone gets plain HTML with no wallet and no RPC key.
- **`computeVerdict()` is a pure, unit-tested function** shared by the page, the API and every implementation.
- **The frontend is never blocked by the program.** The mock ships at 10:45, and swapping to real data at 13:00 is a one-line change.

---

## 1. Frontend Lead: stack decisions

| Area | Decision | Why |
|---|---|---|
| Framework | **Next.js 16.x, App Router, TypeScript, Tailwind** | Current; Turbopack is the default; uncached by default |
| Solana client | **`@solana/web3.js@1`** | Anchor's TS client supports **only web3.js v1**, not `@solana/kit` |
| Program client | **Anchor TS**: version chosen from the IDL format (see below) | Typed `program.methods.*` and `program.account.*` |
| Wallet | **wallet-adapter** with `wallets={[]}` | Phantom is found automatically through Wallet Standard. **Don't** install `wallet-adapter-wallets` (heavy) |
| Data fetching | **TanStack Query v5** | Mutations plus cache refreshes fit the transaction flow |
| QR | **`qrcode.react`** (`QRCodeSVG`) | The phone camera opens the URL, so no scanner library is needed |
| i18n | Plain English copy dictionary (`lib/i18n/index.ts`) | No i18n framework for a one-day build |
| Tests | **Vitest** for `computeVerdict` + the mapper only | These cover the bugs most likely to break the demo |
| State | TanStack Query + URL params | No Redux or Zustand |

### ⚠️ At 10:00, check the IDL format from Solana Playground

Playground's README still lists Anchor 0.29. Look at the top of the exported `medtrace.json`:

| IDL top level looks like | Install | Constructor |
|---|---|---|
| `"address": "…"`, `"metadata": { "spec": … }` (**new format**) | `@coral-xyz/anchor@0.31.1` | `new Program(idl, provider)` |
| `"version"`, `"name"`, `isMut`/`isSigner`, **no `address`** (**legacy**) | `@coral-xyz/anchor@0.29.0` | `new Program(idl, PROGRAM_ID, provider)` |

> Only `lib/medtrace/onchain.ts` imports Anchor, so if the format forces a different version, **only that one file changes**.

```bash
npx create-next-app@latest app --ts --app --src-dir --tailwind --eslint
cd app
npm i @solana/web3.js@1 @coral-xyz/anchor@0.31.1 \
  @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
  @tanstack/react-query qrcode.react buffer
npm i -D vitest
```

---

## 2. Architecture

```
                         ┌──────────────────────────────────────────┐
                         │                 UI LAYER                  │
                         │  (roles)/manufacturer  distributor        │
                         │  (roles)/pharmacy      verify/[serial]    │
                         │  qr/ (print sheet)     regulator (stretch)│
                         └───────────────┬──────────────────────────┘
                                         │ only imports ↓
                         ┌───────────────▼──────────────────────────┐
                         │     MedTraceClient  (lib/medtrace/client) │
                         │  getPack · listPacks · getVerdict         │
                         │  mintPack · transferCustody · dispense    │
                         └───────┬──────────────┬──────────────┬────┘
              DATA_SOURCE=mock   │   =onchain   │    =http     │
                    ┌────────────▼───┐  ┌───────▼───────┐  ┌───▼───────────────────┐
                    │ mock.ts        │  │ onchain.ts    │  │ http.ts               │
                    │ in-memory Map  │  │ Anchor + RPC  │  │ fetch /api/* (reads)  │
                    │ seeded packs   │  │ (devnet)      │  │ writes → onchain      │
                    └────────────────┘  └───────┬───────┘  └───┬───────────────────┘
                                                │              │
                                                │      ┌───────▼───────────────────┐
                                                │      │ Next.js Route Handlers    │
                                                │      │ /api/packs/...  (server)  │
                                                │      │ → onchain.ts today        │
                                                │      │ → indexer / DB tomorrow   │
                                                │      └───────┬───────────────────┘
                                                ▼              ▼
                                      Solana devnet — MedTrace program (P1)
```

**Shared pure modules:** `verdict.ts` (computeVerdict), `mapper.ts` (converts BN and PublicKey to plain JSON), `pda.ts` (PDA derivation and serial normalisation), `errors.ts` (Anchor error → English message).

### How the backend connects
- **Today:** the API routes call `onchain.ts` on the server.
- **Later (indexer, Postgres, relayer):** reimplement only the bodies of the route handlers. The REST contract (§4.3) stays the same, so the UI, set to `DATA_SOURCE=http`, doesn't change.
- **Gasless writes later:** add `POST /api/tx/*` (a relayer) and point the `http.ts` write methods at it.

---

## 3. Folder structure

```
app/src/
├── app/
│   ├── layout.tsx                      # root: fonts, <html lang="en">, no wallet code
│   ├── page.tsx                        # landing: links to roles + sample verify
│   ├── (roles)/
│   │   ├── layout.tsx                  # mounts <Providers> + RoleHeader
│   │   ├── providers.tsx               # "use client": Buffer polyfill, Wallet, Query
│   │   ├── manufacturer/page.tsx       # P2
│   │   ├── distributor/page.tsx        # P2
│   │   ├── pharmacy/page.tsx           # P2
│   │   └── regulator/page.tsx          # P3 stretch
│   ├── verify/[serial]/
│   │   ├── page.tsx                    # P3: Server Component
│   │   ├── loading.tsx                 # skeleton
│   │   ├── error.tsx                   # "Could not reach network, retry"
│   │   └── RecheckButton.tsx           # "use client": router.refresh()
│   ├── qr/page.tsx                     # P3: printable QR sheet
│   └── api/packs/
│       ├── route.ts                    # GET list
│       └── [serial]/
│           ├── route.ts                # GET pack
│           └── verdict/route.ts        # GET verdict
├── components/  (StatusStepper, TxButton, TxToast, VerdictCard, PackCard, RoleHeader, WalletButton)
├── hooks/       (usePack, usePacks, useMint, useTransfer, useDispense, useClient)
├── lib/
│   ├── medtrace/ (types, client, mock, onchain, http, verdict, mapper, pda, errors, config)
│   ├── i18n/     (en.ts, bn.ts)
│   └── explorer.ts
├── idl/          (medtrace.json, medtrace.ts ← P1 commits)
└── tests/        (verdict.test.ts, mapper.test.ts)
```

**Ownership:** P2 owns `lib/medtrace/*`, `hooks/*`, `(roles)/*` and `api/*`. P3 owns `verify/*`, `qr/*`, `VerdictCard`, `lib/i18n/*` and `regulator`. Changes to `types.ts` need **both** P2 and P3 to agree.

---

## 4. The contracts

### 4.1 Types: `lib/medtrace/types.ts` (frozen at 10:30)

```ts
export type Status = "Manufactured" | "InTransit" | "AtPharmacy" | "Dispensed";
export type Verdict = "GENUINE" | "OTHER_PHARMACY" | "ALREADY_DISPENSED" | "UNKNOWN";

export interface Pack {                // JSON-safe DTO: no BN, no PublicKey
  serial: string;                      // "SQ-000123"
  batch: string;
  expiry: number;                      // unix SECONDS
  manufacturer: string;                // base58
  holder: string;                      // base58
  status: Status;
  dispensedAt: number | null;          // unix SECONDS
  address: string;                     // PDA base58 (for Explorer link)
}

export interface VerdictResult {
  verdict: Verdict;
  reason: string;                      // i18n key e.g. "verdict.dispensedJustNow"
  pack: Pack | null;
  checkedAt: number;                   // unix SECONDS
}

export interface TxResult { signature: string; explorerUrl: string; }
export interface MintInput { serial: string; batch: string; expiry: number; }
```

### 4.2 Client interface: `lib/medtrace/client.ts`

```ts
export interface MedTraceReader {
  getPack(serial: string): Promise<Pack | null>;
  listPacks(filter?: { holder?: string; status?: Status }): Promise<Pack[]>;
  getVerdict(serial: string, ctx?: { pharmacy?: string }): Promise<VerdictResult>;
}
export interface MedTraceWriter {
  mintPack(i: MintInput): Promise<TxResult>;
  transferCustody(serial: string, newHolder: string): Promise<TxResult>;
  dispense(serial: string): Promise<TxResult>;
}
export type MedTraceClient = MedTraceReader & MedTraceWriter;

type Source = "mock" | "onchain" | "http";
const SOURCE = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") as Source;

/** Reads: safe on server + browser, no wallet. */
export function getReader(): MedTraceReader {
  if (SOURCE === "mock") return mockClient;
  if (SOURCE === "http") return httpReader;
  return createOnchainReader();
}

/** Writes: need a wallet (browser only). http mode still signs in-browser for now. */
export function getWriter(wallet: AnchorWallet | undefined): MedTraceWriter {
  if (SOURCE === "mock") return mockClient;
  if (!wallet) throw new Error("WALLET_NOT_CONNECTED");
  return createOnchainWriter(wallet);
}
```

### 4.3 REST contract (the backend connection point)

| Method | Path | Returns | Errors |
|---|---|---|---|
| GET | `/api/packs?holder=<pk>&status=<Status>` | `Pack[]` | — |
| GET | `/api/packs/[serial]` | `Pack` | `404 {error:{code:"NOT_FOUND"}}` |
| GET | `/api/packs/[serial]/verdict?pharmacy=<pk>` | `VerdictResult` | never 404; UNKNOWN is a valid verdict |
| POST *(future)* | `/api/tx/mint`, `/api/tx/transfer`, `/api/tx/dispense` | `TxResult` | relayer / gasless |

Rules: every response has `Cache-Control: no-store`, and every error body looks like `{ error: { code, message } }`. Serials are normalised on the server (`trim().toUpperCase()`).

### 4.4 Program contract (agreed with P1 at 10:30)

| Item | Value | Status |
|---|---|---|
| PDA seeds | `["pack", serial_utf8]` | ☐ confirm with P1 |
| Serial | `SQ-000123`, uppercase, ≤ 32 bytes (seed limit) | ☐ |
| `transfer_custody` status logic | 1st transfer → `InTransit`, 2nd → `AtPharmacy` *(or a `to_pharmacy: bool` arg)* | ☐ decide |
| `dispensed_at` | `i64` unix **seconds** | ☐ |
| Account names in instructions | e.g. `pack`, `holder`, `payer`, `systemProgram` | ☐ read from IDL |
| Error codes | e.g. `AlreadyDispensed`, `NotHolder`, `InvalidStatus` | ☐ read from IDL |

---

## 5. Core modules: execution logic

### 5.1 `pda.ts`: one place for serials

```ts
export const normalizeSerial = (s: string) => decodeURIComponent(s).trim().toUpperCase();

export function packPda(serial: string, programId: PublicKey) {
  const s = normalizeSerial(serial);
  if (Buffer.byteLength(s) > 32) throw new Error("SERIAL_TOO_LONG");
  return PublicKey.findProgramAddressSync([Buffer.from("pack"), Buffer.from(s)], programId)[0];
}
```

### 5.2 `mapper.ts`: the only file that touches BN and PublicKey

```ts
const STATUS: Record<string, Status> = {
  manufactured: "Manufactured", intransit: "InTransit",
  atpharmacy: "AtPharmacy",     dispensed: "Dispensed",
};

export function toPack(raw: any, address: PublicKey): Pack {
  const key = Object.keys(raw.status)[0].toLowerCase();       // { atPharmacy: {} } → "atpharmacy"
  const d = raw.dispensedAt;                                   // BN | null | 0
  let dSec = d ? Number(d.toString()) : 0;
  if (dSec > 1e12) dSec = Math.floor(dSec / 1000);              // guard: ms → seconds
  return {
    serial: raw.serial, batch: raw.batch,
    expiry: Number(raw.expiry.toString()),
    manufacturer: raw.manufacturer.toBase58(),
    holder: raw.holder.toBase58(),
    status: STATUS[key],
    dispensedAt: dSec > 0 ? dSec : null,
    address: address.toBase58(),
  };
}
```

### 5.3 `verdict.ts`: pure, tested, `now` passed in

```ts
export const FRESH_DISPENSE_SECONDS = 600;   // 10 minutes

export function computeVerdict(
  pack: Pack | null, nowSec: number, ctx: { pharmacy?: string } = {}
): Omit<VerdictResult, "checkedAt"> {
  if (!pack) return { verdict: "UNKNOWN", reason: "verdict.notRegistered", pack };

  if (pack.status === "Dispensed") {
    const age = nowSec - (pack.dispensedAt ?? 0);
    return age <= FRESH_DISPENSE_SECONDS
      ? { verdict: "GENUINE",           reason: "verdict.dispensedJustNow", pack }
      : { verdict: "ALREADY_DISPENSED", reason: "verdict.codeAlreadyUsed",  pack };
  }

  if (ctx.pharmacy && pack.holder !== ctx.pharmacy)
    return { verdict: "OTHER_PHARMACY", reason: "verdict.registeredElsewhere", pack };

  return {
    verdict: "GENUINE",
    reason: pack.status === "AtPharmacy" ? "verdict.readyAtPharmacy" : "verdict.inSupplyChain",
    pack,
  };
}
```

**Decision table (also the test cases):**

| # | Pack | `now − dispensedAt` | `?pharmacy=` | Verdict |
|---|---|---|---|---|
| 1 | `null` | — | — | UNKNOWN |
| 2 | Dispensed | 30 s | — | GENUINE (just now) |
| 3 | Dispensed | 600 s | — | GENUINE (boundary) |
| 4 | Dispensed | 601 s | — | ALREADY_DISPENSED |
| 5 | AtPharmacy | — | = holder | GENUINE |
| 6 | AtPharmacy | — | ≠ holder | OTHER_PHARMACY |
| 7 | InTransit | — | — | GENUINE (in supply chain) |
| 8 | Raw `dispensedAt` in **ms** (mapper test) | — | — | the mapper converts it to seconds, so the verdict stays correct |

### 5.4 `onchain.ts`: Anchor, isolated

```ts
import { AnchorProvider, Program, AnchorError } from "@coral-xyz/anchor";
import idl from "@/idl/medtrace.json";
import type { Medtrace } from "@/idl/medtrace";

const RPC = typeof window === "undefined"
  ? process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL!      // server: private key-bearing URL
  : process.env.NEXT_PUBLIC_RPC_URL!;
const connection = new Connection(RPC, "confirmed");

export function createOnchainReader(): MedTraceReader {
  const program = new Program(idl as Medtrace, { connection });          // read-only, no wallet
  return {
    async getPack(serial) {
      const pda = packPda(serial, program.programId);
      const raw = await program.account.pack.fetchNullable(pda);
      return raw ? toPack(raw, pda) : null;
    },
    async listPacks(filter) {
      // server-side memcmp filters, offsets from Tech Design §3.1 (holder @40, status @72)
      const filters = filter?.holder ? [{ memcmp: { offset: 40, bytes: filter.holder } }] : [];
      const all = await program.account.pack.all(filters);                // fine for demo scale
      return all.map(a => toPack(a.account, a.publicKey))
                .filter(p => !filter?.status || p.status === filter.status);
    },
    async getVerdict(serial, ctx) {
      const pack = await this.getPack(serial);
      const now = Math.floor(Date.now() / 1000);
      return { ...computeVerdict(pack, now, ctx), checkedAt: now };
    },
  };
}

export function createOnchainWriter(wallet: AnchorWallet): MedTraceWriter {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program(idl as Medtrace, provider);
  const run = async (p: Promise<string>) => {
    try { const sig = await p; return { signature: sig, explorerUrl: explorerTx(sig) }; }
    catch (e) { throw toAppError(e); }                                    // errors.ts
  };
  return {
    mintPack: ({ serial, batch, expiry }) => run(program.methods
      .mintPack(normalizeSerial(serial), batch, new BN(expiry))
      .accountsPartial({ pack: packPda(serial, program.programId), manufacturer: wallet.publicKey })
      .rpc()),
    transferCustody: (serial, newHolder) => run(program.methods
      .transferCustody(new PublicKey(newHolder))
      .accountsPartial({ pack: packPda(serial, program.programId), holder: wallet.publicKey })
      .rpc()),
    dispense: (serial) => run(program.methods
      .dispense()
      .accountsPartial({ pack: packPda(serial, program.programId), holder: wallet.publicKey })
      .rpc()),
  };
}
```

> Account names match the program design (`MedTrace_Tech_Design.md` §3.2): `mintPack` → `{ pack, manufacturer }`, `transferCustody` / `dispense` → `{ pack, holder }`. **Still double-check them against the committed IDL.** With a legacy IDL, use `new Program(idl, PROGRAM_ID, provider)` and `.accounts()`.

### 5.5 `errors.ts`: friendly messages

```ts
export function toAppError(e: unknown): AppError {
  let code = "UNKNOWN";
  if (e instanceof AnchorError) code = e.error.errorCode.code;
  else if ((e as any)?.logs) code = AnchorError.parse((e as any).logs)?.error.errorCode.code ?? code;
  else if (/User rejected/i.test(String((e as any)?.message))) code = "USER_REJECTED";
  else if (/already been processed/i.test(String((e as any)?.message))) code = "DUPLICATE_TX";
  return { code, message: t(`error.${code}`) };
}
```

| Code | Message |
|---|---|
| `AlreadyDispensed` | Already dispensed |
| `NotHolder` | This wallet does not hold the pack |
| `USER_REJECTED` | Transaction cancelled |
| `WALLET_NOT_CONNECTED` | Connect your wallet |
| `UNKNOWN` | Something went wrong, try again |


### 5.6 `mock.ts`: the 10:45 unblocker

```ts
const now = () => Math.floor(Date.now() / 1000);
const W = { mfr: "MfrDemo111…", dist: "DistDemo111…", pharm: "PharmDemo111…", other: "OtherPharm111…" };
const db = new Map<string, Pack>([
  ["SQ-000101", pack("SQ-000101", "AtPharmacy", W.pharm)],                    // GENUINE
  ["SQ-000102", pack("SQ-000102", "Dispensed",  W.pharm, now() - 60)],        // GENUINE (just now)
  ["SQ-000103", pack("SQ-000103", "Dispensed",  W.pharm, now() - 86_400)],    // ALREADY_DISPENSED
  ["SQ-000104", pack("SQ-000104", "AtPharmacy", W.other)],                    // OTHER_PHARMACY with ?pharmacy=W.pharm
]);                                                                           // SQ-999999 → UNKNOWN
// writes mutate the Map, await sleep(800) to feel real, and return a fake signature
```

### 5.7 `http.ts` + Route Handlers

```ts
// lib/medtrace/http.ts
const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
export const httpReader: MedTraceReader = {
  getPack: async s => { const r = await fetch(`${base}/api/packs/${encodeURIComponent(s)}`, { cache: "no-store" });
                        return r.status === 404 ? null : (await r.json()); },
  listPacks: async f => (await fetch(`${base}/api/packs?${new URLSearchParams(f as any)}`, { cache: "no-store" })).json(),
  getVerdict: async (s, c) => (await fetch(`${base}/api/packs/${encodeURIComponent(s)}/verdict?${new URLSearchParams(c as any)}`, { cache: "no-store" })).json(),
};

// app/api/packs/[serial]/verdict/route.ts
export const runtime = "nodejs";
export async function GET(req: Request, { params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;                                  // Next 16: params is a Promise
  const pharmacy = new URL(req.url).searchParams.get("pharmacy") ?? undefined;
  const result = await serverReader().getVerdict(serial, { pharmacy });  // mock|onchain, NEVER http (no loop)
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
```

> **Important:** the route handlers must use a `serverReader()` that returns `mock` or `onchain`, **never `http`**. Otherwise the API calls itself in a loop.

---

## 6. Providers & wallet (role screens only)

```tsx
// app/(roles)/providers.tsx
"use client";
import { Buffer } from "buffer"; (globalThis as any).Buffer ??= Buffer;   // Turbopack-safe polyfill
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 3000 } } }));
  return (
    <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_RPC_URL!}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// components/WalletButton.tsx: avoid hydration mismatch
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(m => m.WalletMultiButton), { ssr: false });
```

`/verify` is **outside** `(roles)`, so the patient page ships no wallet code or Buffer polyfill.

---

## 7. Screens: execution logic

### 7.1 The transaction button state machine (used by every write)

```
 idle ──click──▶ signing ──wallet approves──▶ confirming ──confirmed──▶ success
   ▲               │ user rejects                  │ tx error                 │
   └──── error ◀───┴───────────────────────────────┘                          │
   └──────────────────────────── "Do another" ◀───────────────────────────────┘
```

```ts
// hooks/useDispense.ts (same shape for useMint / useTransfer)
export function useDispense() {
  const wallet = useAnchorWallet(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (serial: string) => getWriter(wallet).dispense(serial),
    onSuccess: (_r, serial) => {
      qc.invalidateQueries({ queryKey: ["pack", normalizeSerial(serial)] });
      qc.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}
```

`<TxButton>` is disabled while `isPending`. It shows "Waiting for wallet…" and then "Confirming on Solana…". On success it shows a toast with the **Explorer link**; on error it shows the mapped message.

### 7.2 RoleHeader (every role screen)

- Wallet button, short address, **role badge**, and the devnet SOL balance.
- The role comes from `lib/medtrace/config.ts`, which maps each demo wallet's public key to Manufacturer, Distributor or Pharmacy.
- If the connected wallet doesn't match the page, show an amber banner: *"You're connected as Distributor. Switch to the Pharmacy account in Phantom."* Warn, don't block.
- If the balance is < 0.05 SOL, show a red banner with a faucet link.

### 7.3 `/manufacturer` (P2)

| Step | Logic |
|---|---|
| Load | Pre-fill the **next serial**: highest `SQ-` number from `listPacks({})` + 1. Batch defaults to `B-2026-09`; expiry defaults to +2 years |
| Validate | Serial matches `^SQ-\d{6}$` and fits in 32 bytes; batch isn't empty; expiry is in the future; `getPack(serial)` returns null (otherwise show "Serial already exists") |
| Submit | `useMint` → TxButton states |
| Success | **PackCard**: serial, status stepper at *Manufactured*, **QR** (`QRCodeSVG` → `${APP_URL}/verify/${serial}`), "Open on Explorer", "Print QR" (→ `/qr?serial=`) |
| List | "My packs": `usePacks({ holder: me })`, polled every 10 s |

### 7.4 `/distributor` (P2)

| Step | Logic |
|---|---|
| Lookup | Serial input (or `?serial=` in the URL) → `usePack(serial)` → PackCard + stepper |
| Guard | Only enable Transfer when `pack.holder === me`; otherwise show "Held by <role>" |
| Target | **Dropdown of named demo wallets** from config (no pasting pubkeys on stage) + an "Other address" option |
| Submit | `useTransfer` → invalidate → stepper advances to *InTransit* / *AtPharmacy* |
| Inbox | "Packs I hold": `usePacks({ holder: me })` with one-click select |

### 7.5 `/pharmacy` (P2)

| Step | Logic |
|---|---|
| Lookup | Same as the distributor screen, plus the list of "Packs in stock" (`holder === me && status === AtPharmacy`) |
| Guard | Enable **Dispense** only when the status is `AtPharmacy` and the holder is me |
| Submit | `useDispense` → success shows a big "Dispensed ✅ at 14:32" + QR + "Patient: scan now" |
| Double dispense | If a pack is already dispensed, the button still exists in demo mode: clicking it shows the mapped `AlreadyDispensed` error. **This proves the check happens onchain** |

### 7.6 `/verify/[serial]` (P3): Server Component

```tsx
// app/verify/[serial]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";                   // verdict depends on time, never cache

export default async function VerifyPage({ params, searchParams }: {
  params: Promise<{ serial: string }>; searchParams: Promise<{ pharmacy?: string }>;
}) {
  const { serial } = await params; const { pharmacy } = await searchParams;
  const result = await serverReader().getVerdict(normalizeSerial(serial), { pharmacy });
  return <VerdictCard result={result} />;                 // + <RecheckButton/> (client, router.refresh())
}
```

**VerdictCard layout (mobile-first, readable at arm's length):**

| Verdict | Colour | Icon | Label |
|---|---|---|---|
| GENUINE | green | ✅ | Genuine medicine |
| ALREADY_DISPENSED | red | 🚫 | Code already used, possible fake |
| OTHER_PHARMACY | amber | ⚠️ | Registered to another pharmacy |
| UNKNOWN | red | 🚫 | Not registered, possible fake |

- The full-width colour block shows icon + text, so **the meaning never depends on colour alone**.
- Details: serial, batch, expiry (flag it red if expired), manufacturer (short address), dispensed time ("2 minutes ago"), and an "Explorer" link to the PDA.
- Verdict text ≥ 32 px, body ≥ 16 px, tap targets ≥ 44 px.
- `loading.tsx` is a skeleton; `error.tsx` shows "Network busy, tap to retry" (it doesn't claim the pack is fake).

### 7.7 `/qr` (P3): printable sheet

- `?serial=SQ-000123`, or the whole list. Each tile is `QRCodeSVG` (level `M`, ~5 cm) + the serial printed underneath.
- Print CSS: `@media print` hides the nav, 2 × 3 grid.
- **Print only after the final Vercel URL is fixed**, because the URL is baked into every QR.

### 7.8 `/regulator` (P3 stretch)

- A read-only table from `listPacks()`: serial, batch, status, holder role, dispensed time. Status filter chips, refreshed every 10 s.

---

## 8. Environment & config

| Var | Where | Example | Note |
|---|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | client + server | `mock` → `onchain` → `http` | **The one-line swap** |
| `NEXT_PUBLIC_RPC_URL` | browser | `https://api.devnet.solana.com` | Public endpoint; rate-limited |
| `RPC_URL` | **server only** | `https://devnet.helius-rpc.com/?api-key=…` | Free Helius key. **Never** prefix it with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | both | `https://medtrace.vercel.app` | Used in QR codes |
| `NEXT_PUBLIC_CLUSTER` | both | `devnet` | Explorer links |
| `NEXT_PUBLIC_PROGRAM_ID` | both | `Med…` | Only needed for a legacy IDL (otherwise `idl.address`) |

- Commit `.env.example`, never `.env.local`.
- **`NEXT_PUBLIC_*` values are baked in at build time**, so after changing one on Vercel, **redeploy**.
- Demo wallets go in `lib/medtrace/config.ts` (**public keys only**) with their role names.

---

## 9. Tests (15 minutes, high value)

```ts
// tests/verdict.test.ts
import { describe, it, expect } from "vitest";
const now = 1_790_000_000;
describe("computeVerdict", () => {
  it("unknown", () => expect(computeVerdict(null, now).verdict).toBe("UNKNOWN"));
  it("fresh dispense", () => expect(computeVerdict(p({ status: "Dispensed", dispensedAt: now - 30 }), now).verdict).toBe("GENUINE"));
  it("boundary 600s", () => expect(computeVerdict(p({ status: "Dispensed", dispensedAt: now - 600 }), now).verdict).toBe("GENUINE"));
  it("clone", () => expect(computeVerdict(p({ status: "Dispensed", dispensedAt: now - 601 }), now).verdict).toBe("ALREADY_DISPENSED"));
  it("other pharmacy", () => expect(computeVerdict(p({ holder: "A" }), now, { pharmacy: "B" }).verdict).toBe("OTHER_PHARMACY"));
});

// tests/mapper.test.ts
it("normalises ms timestamps to seconds", () =>
  expect(toPack(rawPack({ dispensedAt: new BN(1_790_000_000_000) }), pda).dispensedAt).toBe(1_790_000_000));
```

> **Why the ms test matters:** if `dispensedAt` ever arrives in milliseconds, the age becomes negative, so a clone scan would read **GENUINE forever**, which breaks the demo punchline. The mapper guard (§5.2) plus this test prevent that. **Also add** a smoke script, `npx tsx scripts/smoke.ts SQ-000123`, that reads one real devnet pack and prints the DTO.

Run `npm run test && npm run build` before every merge to `main`.

---

## 10. Timeline & execution order

| Time | P2: client + roles | P3: verify + demo | Gate |
|---|---|---|---|
| **10:00–10:30** | Scaffold the app, install deps, providers, wallet button → push to `main`. **Check the IDL format** | Link Vercel, set env vars, `qrcode.react` | Wallet connects on the Vercel URL |
| **10:30–10:45** | 🤝 Freeze `types.ts` + §4.4 with P1 | 🤝 Agree verdict rules + i18n keys | Contract pinned in chat |
| **10:45** | ✅ **Ship `mock.ts` + `client.ts` factory** | Start building against the mock | P3 unblocked |
| **10:45–12:00** | `pda`, `mapper`, `errors`, `TxButton`, `RoleHeader`, hooks | `verdict.ts` + tests, `VerdictCard`, `/verify` page on the mock | 4 verdicts render on a phone |
| **12:00–13:00** | `/manufacturer` (mint → PackCard + QR) | `/qr` print sheet, mobile polish, API routes review | Mint works on the mock |
| **13:00–13:30** | 🔌 **P1 ships the IDL** → `onchain.ts` → flip `DATA_SOURCE=onchain` | Point `/verify` at real data; smoke test | **First real transaction from the UI** |
| **13:30–15:00** | `/distributor`, `/pharmacy`, error mapping, polling | API routes (`/api/packs/*`), demo script, `/regulator` (stretch) | Full flow on the preview URL |
| **15:00** | Sync: end-to-end on the Vercel URL? What gets cut? | ← | — |
| **15:30** | ❄️ **Feature freeze.** Only bug fixes | 🎥 **Record the backup video** | Video saved in `/demo` |
| **15:30–17:00** | Rename Phantom accounts; pre-mint spare packs; hand screenshots to P4 | Print final QR codes; rehearse ×3 | — |
| **17:00+** | 🎤 Final rehearsal | ← | .pptx submitted |

### Merge order to `main` (keeps `main` demo-ready)
1. Scaffold + providers → 2. `types` + `client` + `mock` → 3. `verdict` + tests → 4. `/verify` → 5. `/manufacturer` → 6. `onchain` + env flip → 7. `/distributor` + `/pharmacy` → 8. API routes → 9. `/qr`, `/regulator`.

---

## 11. Go / no-go checkpoints (frontend)

| Time | Must be true | If not → |
|---|---|---|
| 10:45 | Mock merged; `/verify/SQ-000101` renders | P2 pushes a bare mock in 10 min; P3 hard-codes a Pack |
| 12:30 | All 4 verdicts work on a phone (mock); mint works on the mock | Drop OTHER_PHARMACY from the UI |
| 13:30 | Real `getPack` works; one real mint from the UI | Pair P1+P2; fall back to the IDL version switch; last resort: demo on the mock + Playground Explorer links |
| 15:30 | mint → transfer → dispense → verify → clone 🚫 on the **Vercel** URL | Freeze, record the video, cut `/regulator` |

---

## 12. Top risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Playground IDL is the legacy format or has a missing `types` section | Check at 10:00; pin the Anchor version (§1); the mock keeps the UI moving |
| 2 | IDL / program ID drifts after P1 redeploys | P1 recommits the IDL on **every** deploy; the program ID lives in one place |
| 3 | Devnet 429s or outages | Helius key on the server; ≥ 5 s polling; backup video |
| 4 | Seconds vs milliseconds bug | Mapper guard + unit test |
| 5 | Wallet button hydration error | `dynamic(..., { ssr:false })`; providers only in `(roles)` |
| 6 | `Buffer is not defined` | Polyfill at the top of `providers.tsx` |
| 7 | Demo wallets run out of SOL | Fund them in the morning; low-balance banner in RoleHeader |
| 8 | The phone can't open the site | Use the Vercel URL (not Codespaces); test over 4G; print the QR codes after the final URL |
| 9 | Serial or seed mismatch (case, spaces, > 32 bytes) | `normalizeSerial` + a shared `packPda` everywhere |
| 10 | The 10-minute window expires mid-demo | Dispense **live** right before the scan; keep a pre-dispensed spare for the clone |
| 11 | wallet-adapter UI misbehaves on React 19 / Next 16 | Test in hour 1; fallback: a plain `window.phantom.solana.connect()` button |

---

## 13. Team rules (Frontend Lead)

1. **The UI imports only `MedTraceClient`**, never Anchor or web3.js directly.
2. **Only `mapper.ts` touches BN and PublicKey.** Everything else uses plain JSON types.
3. **`computeVerdict` stays pure**, `now` is passed in, and it's covered by tests.
4. **API routes use `serverReader()`, never the `http` client** (no self-loop).
5. **Never cache verdicts** (`no-store`, `force-dynamic`).
6. **Secrets are server-only.** Nothing secret gets `NEXT_PUBLIC_`, and keypairs never go in the repo.
7. **Every transaction button has disabled, pending, success and error states**, and success always shows an Explorer link.
8. **Mobile-first, meaning never shown by colour alone**, 44 px tap targets.
9. **Stay in your own folder**; changes to `types.ts` need both P2 and P3.
10. **Small PRs.** `npm run test && npm run build` must pass, and `main` is always demo-ready.

---

## 14. Demo run sheet (< 60 s)

| # | Screen (wallet) | Action | P2 narrates |
|---|---|---|---|
| 1 | `/manufacturer` (Manufacturer) | Mint `SQ-000130` → Explorer | "A manufacturer registers this pack on Solana." |
| 2 | `/distributor` (Distributor) | Transfer → Pharmacy | "Every handover is signed and public." |
| 3 | `/pharmacy` (Pharmacy) | Dispense | "The pharmacy dispenses it to the patient." |
| 4 | Phone scans the **genuine** box | ✅ Genuine medicine | "The patient scans: genuine, dispensed just now." |
| 5 | Phone scans the **photocopied clone** of a pre-dispensed pack | 🚫 ALREADY DISPENSED | "A counterfeiter copies the code, and the chain already knows it was used." |
| 6 | (optional) Phone scans `SQ-999999` | 🚫 UNKNOWN | "An unregistered code is flagged straight away." |

**Phone setup:** brightness at max, auto-lock off, the Vercel URL already open, hotspot ready.

---

## 15. Backend handoff (after the hackathon)

When a real backend exists (an indexer such as a Helius webhook → Postgres, a pharmacy registry, or a gasless relayer):

1. Keep the **§4.3 REST contract** exactly.
2. Reimplement the route handler bodies against the DB or indexer, instead of `onchain.ts`.
3. Set `NEXT_PUBLIC_DATA_SOURCE=http`. **No UI changes are needed.**
4. For gasless writes: add `POST /api/tx/*` and point the `http.ts` writer at it.
5. Add auth (for example, the pharmacy signs a message with its wallet) to the write endpoints only; verify stays public.

---

### References
[Anchor TS client](https://www.anchor-lang.com/docs/clients/typescript) · [Anchor 0.30 release notes](https://www.anchor-lang.com/docs/updates/release-notes/0-30-0) · [Anchor 1.0 release notes](https://www.anchor-lang.com/docs/updates/release-notes/1-0-0) · [Solana Playground](https://github.com/solana-playground/solana-playground) · [Solana + Next.js guide](https://solana.com/docs/frontend/nextjs-solana) · [Next.js 16.3](https://nextjs.org/blog/next-16-3) · [Solana clusters / rate limits](https://solana.com/docs/references/clusters) · [Helius pricing](https://www.helius.dev/pricing) · [wallet-adapter](https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md)

*Not verified: the Anchor version and IDL format Playground currently exports; the exact latest npm versions; how wallet-adapter-react-ui behaves on React 19. Check all three in the first hour.*
