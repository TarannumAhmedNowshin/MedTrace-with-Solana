export const fmtDate = (sec: number | null | undefined) =>
  sec ? new Date(sec * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (sec: number | null | undefined) =>
  sec
    ? new Date(sec * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

export function timeAgo(sec: number | null | undefined, now = Date.now() / 1000): string {
  if (!sec) return "—";
  const d = Math.max(0, Math.round(now - sec));
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  const days = Math.round(d / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
