/** Serial helpers: pure, no Solana imports (safe in every runtime). */

export const SERIAL_RE = /^[A-Z0-9-]{1,32}$/;
export const DEMO_SERIAL_RE = /^SQ-\d{6}$/;
export const MAX_SEED_BYTES = 32;

export function normalizeSerial(input: string): string {
  let s = input;
  try {
    s = decodeURIComponent(input);
  } catch {
    /* already decoded */
  }
  return s.trim().toUpperCase();
}

export function isValidSerial(serial: string): boolean {
  const s = normalizeSerial(serial);
  return SERIAL_RE.test(s) && new TextEncoder().encode(s).length <= MAX_SEED_BYTES;
}

/** Highest SQ-###### + 1, used to pre-fill the manufacturer form. */
export function nextSerial(existing: string[], start = 100): string {
  const max = existing.reduce((m, s) => {
    const match = /^SQ-(\d{6})$/.exec(s);
    return match ? Math.max(m, Number(match[1])) : m;
  }, start);
  return `SQ-${String(max + 1).padStart(6, "0")}`;
}

export const nowSec = () => Math.floor(Date.now() / 1000);

export const shortAddr = (a: string, n = 4) =>
  a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
