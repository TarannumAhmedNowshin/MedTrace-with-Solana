/**
 * In-memory MedTrace store that mirrors the onchain program's rules exactly
 * (Tech Design §3.2–3.4): same state machine, same error names.
 * Used by: the server in mock mode, and the offline preview build.
 */
import { MOCK_KEYS } from "./config";
import { isValidSerial, normalizeSerial, nowSec } from "./serial";
import { AppError, type MintInput, type Pack, type PackFilter, type Status } from "./types";

const { manufacturer: MFR, distributor: DIST, pharmacy: PHARM, otherPharmacy: OTHER } = MOCK_KEYS;

const YEAR = 365 * 24 * 3600;

function seedPack(serial: string, status: Status, holder: string, dispensedAgo?: number): Pack {
  const now = nowSec();
  return {
    serial,
    batch: "B-2026-09",
    expiry: now + 2 * YEAR,
    manufacturer: MFR,
    holder,
    status,
    dispensedAt: dispensedAgo === undefined ? null : now - dispensedAgo,
    createdAt: now - 3 * 24 * 3600,
    address: `mock:${serial}`,
  };
}

export function seedPacks(): Pack[] {
  return [
    seedPack("SQ-000101", "AtPharmacy", PHARM), // GENUINE (ready at pharmacy)
    seedPack("SQ-000102", "Dispensed", PHARM, 60), // GENUINE (dispensed just now)
    seedPack("SQ-000103", "Dispensed", PHARM, 86_400), // ALREADY_DISPENSED (the clone)
    seedPack("SQ-000104", "AtPharmacy", OTHER), // OTHER_PHARMACY with ?pharmacy=PHARM
    seedPack("SQ-000105", "InTransit", DIST), // GENUINE (in supply chain)
    seedPack("SQ-000106", "Manufactured", MFR), // GENUINE (fresh mint)
    // SQ-999999 → not present → UNKNOWN
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fakeSig = () =>
  "mock" + Array.from({ length: 60 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join("");

export class MockStore {
  private packs = new Map<string, Pack>();

  constructor(
    seed: Pack[] = seedPacks(),
    private latencyMs = 500,
  ) {
    seed.forEach((p) => this.packs.set(p.serial, p));
  }

  reset() {
    this.packs.clear();
    seedPacks().forEach((p) => this.packs.set(p.serial, p));
  }

  // ─── reads ──────────────────────────────────────────────────────────
  async getPack(serial: string): Promise<Pack | null> {
    await sleep(this.latencyMs / 3);
    const p = this.packs.get(normalizeSerial(serial));
    return p ? { ...p } : null;
  }

  async listPacks(filter: PackFilter = {}): Promise<Pack[]> {
    await sleep(this.latencyMs / 3);
    return [...this.packs.values()]
      .filter((p) => (!filter.holder || p.holder === filter.holder) && (!filter.status || p.status === filter.status))
      .sort((a, b) => a.serial.localeCompare(b.serial))
      .map((p) => ({ ...p }));
  }

  // ─── writes (same checks as the Anchor program) ─────────────────────
  async mintPack(signer: string, input: MintInput): Promise<string> {
    await sleep(this.latencyMs);
    const serial = normalizeSerial(input.serial);
    if (!isValidSerial(serial)) throw new AppError("InvalidSerial");
    if (!/^[\x20-\x7e]{1,16}$/.test(input.batch)) throw new AppError("InvalidBatch"); // same rule as program rules.rs
    const now = nowSec();
    if (input.expiry <= now) throw new AppError("AlreadyExpired");
    if (this.packs.has(serial)) throw new AppError("SerialTaken");
    this.packs.set(serial, {
      serial,
      batch: input.batch,
      expiry: input.expiry,
      manufacturer: signer,
      holder: signer,
      status: "Manufactured",
      dispensedAt: null,
      createdAt: now,
      address: `mock:${serial}`,
    });
    return fakeSig();
  }

  async transferCustody(signer: string, serial: string, newHolder: string): Promise<string> {
    await sleep(this.latencyMs);
    const p = this.mustGet(serial);
    if (p.holder !== signer) throw new AppError("NotHolder");
    if (newHolder === p.holder) throw new AppError("SameHolder");
    const next: Record<Status, Status | AppError> = {
      Manufactured: "InTransit",
      InTransit: "AtPharmacy",
      AtPharmacy: new AppError("InvalidStatus"),
      Dispensed: new AppError("AlreadyDispensed"),
    };
    const to = next[p.status];
    if (to instanceof AppError) throw to;
    this.packs.set(p.serial, { ...p, holder: newHolder, status: to });
    return fakeSig();
  }

  async dispense(signer: string, serial: string): Promise<string> {
    await sleep(this.latencyMs);
    const p = this.mustGet(serial);
    if (p.holder !== signer) throw new AppError("NotHolder");
    if (p.status === "Dispensed") throw new AppError("AlreadyDispensed");
    if (p.status !== "AtPharmacy") throw new AppError("NotAtPharmacy");
    this.packs.set(p.serial, { ...p, status: "Dispensed", dispensedAt: nowSec() });
    return fakeSig();
  }

  private mustGet(serial: string): Pack {
    const p = this.packs.get(normalizeSerial(serial));
    if (!p) throw new AppError("NOT_FOUND", "Pack not found", 404);
    return p;
  }
}

/** One store per server process (survives Next.js dev hot-reloads). */
const g = globalThis as unknown as { __medtraceMock?: MockStore };
export const mockStore: MockStore = (g.__medtraceMock ??= new MockStore());
