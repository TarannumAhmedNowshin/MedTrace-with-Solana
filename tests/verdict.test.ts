import { describe, expect, it } from "vitest";
import { computeVerdict, FRESH_DISPENSE_SECONDS } from "@/lib/medtrace/verdict";
import type { Pack } from "@/lib/medtrace/types";

const NOW = 1_790_000_000;
const p = (o: Partial<Pack> = {}): Pack => ({
  serial: "SQ-000123", batch: "B-1", expiry: NOW + 1e7, manufacturer: "M", holder: "PHARM",
  status: "AtPharmacy", dispensedAt: null, createdAt: NOW - 100, address: "mock:SQ-000123", ...o,
});

describe("computeVerdict", () => {
  it("1. unknown pack → UNKNOWN", () => expect(computeVerdict(null, NOW).verdict).toBe("UNKNOWN"));
  it("2. dispensed 30s ago → GENUINE", () => {
    const r = computeVerdict(p({ status: "Dispensed", dispensedAt: NOW - 30 }), NOW);
    expect([r.verdict, r.reason]).toEqual(["GENUINE", "dispensedJustNow"]);
  });
  it("3. boundary: exactly 600s → GENUINE", () =>
    expect(computeVerdict(p({ status: "Dispensed", dispensedAt: NOW - FRESH_DISPENSE_SECONDS }), NOW).verdict).toBe("GENUINE"));
  it("4. 601s → ALREADY_DISPENSED (the clone)", () =>
    expect(computeVerdict(p({ status: "Dispensed", dispensedAt: NOW - 601 }), NOW).verdict).toBe("ALREADY_DISPENSED"));
  it("5. at pharmacy, scanned by same pharmacy → GENUINE", () =>
    expect(computeVerdict(p(), NOW, { pharmacy: "PHARM" }).verdict).toBe("GENUINE"));
  it("6. at pharmacy, scanned by other pharmacy → OTHER_PHARMACY", () =>
    expect(computeVerdict(p(), NOW, { pharmacy: "OTHER" }).verdict).toBe("OTHER_PHARMACY"));
  it("7. in transit → GENUINE (in supply chain)", () =>
    expect(computeVerdict(p({ status: "InTransit" }), NOW).reason).toBe("inSupplyChain"));
  it("8. dispensed pack ignores ?pharmacy (clone check wins)", () =>
    expect(computeVerdict(p({ status: "Dispensed", dispensedAt: NOW - 9999 }), NOW, { pharmacy: "OTHER" }).verdict).toBe("ALREADY_DISPENSED"));
  it("9. expiry flag", () => expect(computeVerdict(p({ expiry: NOW - 1 }), NOW).expired).toBe(true));
});
