"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RecheckButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-ghost btn-block" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? <><span className="spinner" aria-hidden /> Checking…</> : "Check again"}
    </button>
  );
}
