"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { normalizeSerial } from "@/lib/medtrace/serial";

/** Selected pack lives in the URL (?serial=SQ-000123): shareable, survives refresh. */
export function useSelectedSerial(): [string | undefined, (s: string | undefined) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params?.get("serial");
  const serial = raw ? normalizeSerial(raw) : undefined;
  const set = useCallback(
    (s: string | undefined) => router.replace(s ? `${pathname}?serial=${encodeURIComponent(s)}` : pathname ?? "/", { scroll: false }),
    [router, pathname],
  );
  return [serial, set];
}
