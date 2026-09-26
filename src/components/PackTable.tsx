"use client";
import { timeAgo } from "@/lib/format";
import type { Pack } from "@/lib/medtrace/types";
import { Addr, Empty, Skeleton, StatusBadge } from "./ui";

export function PackTable({
  packs,
  loading,
  selected,
  onSelect,
  empty = "No packs yet.",
  showHolder = true,
}: {
  packs: Pack[] | undefined;
  loading?: boolean;
  selected?: string;
  onSelect?: (serial: string) => void;
  empty?: string;
  showHolder?: boolean;
}) {
  if (loading && !packs) {
    return (
      <div className="stack" aria-busy>
        <Skeleton h={44} />
        <Skeleton h={44} />
        <Skeleton h={44} />
      </div>
    );
  }
  if (!packs?.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Serial</th>
            <th scope="col">Batch</th>
            <th scope="col">Status</th>
            {showHolder && <th scope="col">Holder</th>}
            <th scope="col">Dispensed</th>
          </tr>
        </thead>
        <tbody>
          {packs.map((p) => (
            <tr
              key={p.serial}
              className={`${onSelect ? "clickable" : ""} ${selected === p.serial ? "selected" : ""}`}
              onClick={onSelect ? () => onSelect(p.serial) : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyDown={onSelect ? (e) => e.key === "Enter" && onSelect(p.serial) : undefined}
              aria-selected={onSelect ? selected === p.serial : undefined}
            >
              <td className="mono"><strong>{p.serial}</strong></td>
              <td>{p.batch}</td>
              <td><StatusBadge status={p.status} /></td>
              {showHolder && <td><Addr value={p.holder} /></td>}
              <td className="muted">{p.dispensedAt ? timeAgo(p.dispensedAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
