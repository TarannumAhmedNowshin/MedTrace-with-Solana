import { describe, expect, it } from "vitest";
import { toAppError } from "@/lib/medtrace/errors";
import { isValidSerial, nextSerial, normalizeSerial } from "@/lib/medtrace/serial";

describe("toAppError", () => {
  it("reads AnchorError shape", () =>
    expect(toAppError({ error: { errorCode: { code: "AlreadyDispensed" } } }).code).toBe("AlreadyDispensed"));
  it("reads program logs", () =>
    expect(toAppError({ logs: ["Program log: AnchorError ... Error Code: NotHolder. Error Number: 6003."] }).code).toBe("NotHolder"));
  it("maps wallet rejection", () => expect(toAppError(new Error("User rejected the request.")).code).toBe("USER_REJECTED"));
  it("maps duplicate init to SerialTaken", () =>
    expect(toAppError({ logs: ["Allocate: account Address { address: X } already in use"] }).code).toBe("SerialTaken"));
});

describe("serial helpers", () => {
  it("normalises", () => expect(normalizeSerial(" sq-000123%20")).toBe("SQ-000123"));
  it("validates length ≤ 32 bytes", () => {
    expect(isValidSerial("SQ-000123")).toBe(true);
    expect(isValidSerial("S".repeat(33))).toBe(false);
  });
  it("suggests next serial", () => expect(nextSerial(["SQ-000101", "SQ-000109", "junk"])).toBe("SQ-000110"));
});

import { isPublicKeyLike } from "@/lib/medtrace/config";
describe("address validation", () => {
  it("accepts base58 public keys, rejects junk", () => {
    expect(isPublicKeyLike("11111111111111111111111111111111")).toBe(true);
    expect(isPublicKeyLike("0xabc")).toBe(false);
    expect(isPublicKeyLike("not a key")).toBe(false);
  });
});
