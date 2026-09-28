import { describe, expect, it } from "vitest";
import { redact } from "../src/lib/medtrace/redact";

describe("redact", () => {
  it("hides RPC URLs and API keys", () => {
    const s = redact("failed to get slot: 401 https://devnet.helius-rpc.com/?api-key=abc123 unauthorized");
    expect(s).not.toContain("abc123");
    expect(s).not.toContain("helius");
  });
  it("hides filesystem paths and keeps the first line only", () => {
    const s = redact("require() of /var/task/node_modules/uuid/index.js failed\n    at Object.<anonymous>");
    expect(s).not.toContain("/var/task");
    expect(s).not.toContain("at Object");
  });
  it("keeps harmless messages readable", () => {
    expect(redact("Unknown status Foo")).toBe("Unknown status Foo");
  });
});
