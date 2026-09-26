import { ok, fail } from "@/lib/medtrace/api";
import { serverReader } from "@/lib/medtrace/server";
import { isValidSerial, normalizeSerial } from "@/lib/medtrace/serial";
import { AppError } from "@/lib/medtrace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/packs/:serial/verdict?pharmacy=<pk> → VerdictResult (UNKNOWN is a valid answer, never 404) */
export async function GET(req: Request, { params }: { params: Promise<{ serial: string }> }) {
  try {
    const serial = normalizeSerial((await params).serial);
    if (!isValidSerial(serial)) throw new AppError("InvalidSerial");
    const pharmacy = new URL(req.url).searchParams.get("pharmacy") ?? undefined;
    return ok(await (await serverReader()).getVerdict(serial, { pharmacy }));
  } catch (e) {
    return fail(e);
  }
}
