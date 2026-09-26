import { describe, expect, it } from "vitest";
import { MockStore } from "@/lib/medtrace/mockStore";
import { nowSec } from "@/lib/medtrace/serial";

const MFR = "MFR", DIST = "DIST", PHARM = "PHARM";
const fresh = () => new MockStore([], 0);
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => e.code);

describe("MockStore mirrors program rules", () => {
  it("full happy path mint → transfer → transfer → dispense", async () => {
    const s = fresh();
    await s.mintPack(MFR, { serial: "sq-000001", batch: "B", expiry: nowSec() + 1000 });
    expect((await s.getPack("SQ-000001"))?.status).toBe("Manufactured");
    await s.transferCustody(MFR, "SQ-000001", DIST);
    expect((await s.getPack("SQ-000001"))?.status).toBe("InTransit");
    await s.transferCustody(DIST, "SQ-000001", PHARM);
    expect((await s.getPack("SQ-000001"))?.status).toBe("AtPharmacy");
    await s.dispense(PHARM, "SQ-000001");
    const p = await s.getPack("SQ-000001");
    expect(p?.status).toBe("Dispensed");
    expect(p?.dispensedAt).toBeGreaterThan(0);
  });
  it("rejects: duplicate serial, non-holder, double dispense, early dispense, same holder", async () => {
    const s = fresh();
    const exp = nowSec() + 1000;
    await s.mintPack(MFR, { serial: "SQ-000002", batch: "B", expiry: exp });
    expect(await code(s.mintPack(MFR, { serial: "SQ-000002", batch: "B", expiry: exp }))).toBe("SerialTaken");
    expect(await code(s.transferCustody(DIST, "SQ-000002", PHARM))).toBe("NotHolder");
    expect(await code(s.transferCustody(MFR, "SQ-000002", MFR))).toBe("SameHolder");
    expect(await code(s.dispense(MFR, "SQ-000002"))).toBe("NotAtPharmacy");
    await s.transferCustody(MFR, "SQ-000002", DIST);
    await s.transferCustody(DIST, "SQ-000002", PHARM);
    expect(await code(s.transferCustody(PHARM, "SQ-000002", DIST))).toBe("InvalidStatus");
    await s.dispense(PHARM, "SQ-000002");
    expect(await code(s.dispense(PHARM, "SQ-000002"))).toBe("AlreadyDispensed");
  });
  it("validates mint input", async () => {
    const s = fresh();
    expect(await code(s.mintPack(MFR, { serial: "X".repeat(33), batch: "B", expiry: nowSec() + 10 }))).toBe("InvalidSerial");
    expect(await code(s.mintPack(MFR, { serial: "SQ-1", batch: "", expiry: nowSec() + 10 }))).toBe("InvalidBatch");
    expect(await code(s.mintPack(MFR, { serial: "SQ-1", batch: "B", expiry: nowSec() - 10 }))).toBe("AlreadyExpired");
  });
});
