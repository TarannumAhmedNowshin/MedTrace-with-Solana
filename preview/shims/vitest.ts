// Offline stand-in for vitest (the sandbox has no npm access). Real runs use `npm test`.
import { describe as d, it as i } from "node:test";
import assert from "node:assert/strict";
export const describe = d;
export const it = i;
export function expect(actual: unknown) {
  return {
    toBe: (e: unknown) => assert.strictEqual(actual, e),
    toEqual: (e: unknown) => assert.deepStrictEqual(actual, e),
    toThrow: () => assert.throws(actual as () => unknown),
    toBeGreaterThan: (n: number) => assert.ok((actual as number) > n, `${actual} > ${n}`),
  };
}
