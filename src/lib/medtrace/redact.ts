/**
 * Scrubs values that must never reach a client or a log line verbatim:
 * RPC URLs (they can carry API keys, e.g. Helius `?api-key=`), filesystem paths and stack frames.
 */
export function redact(input: unknown, max = 200): string {
  return String(input ?? "")
    .replace(/https?:\/\/[^\s"'<>)]+/gi, "[url]")
    .replace(/(api[-_]?key|token|secret)=[^&\s"']+/gi, "$1=[redacted]")
    .replace(/(\/[\w.@-]+){2,}/g, "[path]")
    .split("\n")[0]
    .slice(0, max);
}
