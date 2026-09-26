import { describe, expect, it } from "vitest";
import { toPack, toSeconds, toStatus } from "@/lib/medtrace/mapper";

const bn = (n: number) => ({ toString: () => String(n) });
const key = (s: string) => ({ toBase58: () => s });

describe("mapper", () => {
  it("maps Anchor enum variants (camel, snake, Pascal)", () => {
    expect(toStatus({ atPharmacy: {} })).toBe("AtPharmacy");
    expect(toStatus({ in_transit: {} })).toBe("InTransit");
    expect(toStatus({ Dispensed: {} })).toBe("Dispensed");
  });
  it("throws on unknown enum variant", () => expect(() => toStatus({ lost: {} })).toThrow());
  it("normalises ms timestamps to seconds", () => expect(toSeconds(1_790_000_000_000)).toBe(1_790_000_000));
  it("maps a raw account to a JSON-safe Pack; dispensedAt 0 → null", () => {
    const pack = toPack(
      { serial: "SQ-000001", batch: "B", expiry: bn(1_800_000_000), manufacturer: key("MFR"), holder: key("H"),
        status: { manufactured: {} }, dispensedAt: bn(0), createdAt: bn(1_790_000_000) },
      key("PDA"),
    );
    expect(pack).toEqual({ serial: "SQ-000001", batch: "B", expiry: 1_800_000_000, manufacturer: "MFR", holder: "H",
      status: "Manufactured", dispensedAt: null, createdAt: 1_790_000_000, address: "PDA" });
    expect(JSON.parse(JSON.stringify(pack))).toEqual(pack);
  });
});
