import type { Metadata } from "next";
import { RecheckButton } from "./RecheckButton";
import { VerdictView } from "@/components/VerdictView";
import { VerifyShell } from "@/components/VerifyShell";
import { serverReader } from "@/lib/medtrace/server";
import { isValidSerial, normalizeSerial } from "@/lib/medtrace/serial";
import { computeVerdict } from "@/lib/medtrace/verdict";

// The verdict depends on the current time → never cache, always render per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ serial: string }>; searchParams: Promise<{ pharmacy?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Verify ${normalizeSerial((await params).serial)}`, robots: { index: false } };
}

export default async function VerifyPage({ params, searchParams }: Props) {
  const serial = normalizeSerial((await params).serial);
  const { pharmacy } = await searchParams;

  // Malformed codes are simply not registered; no RPC call needed.
  const result = isValidSerial(serial)
    ? await (await serverReader()).getVerdict(serial, { pharmacy })
    : computeVerdict(null, Math.floor(Date.now() / 1000));

  return (
    <VerifyShell>
      <VerdictView result={result} serial={serial} />
      <RecheckButton />
    </VerifyShell>
  );
}
