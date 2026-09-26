import { ok, fail } from "@/lib/medtrace/api";
import { serverReader } from "@/lib/medtrace/server";
import { isValidSerial, normalizeSerial } from "@/lib/medtrace/serial";
import { AppError } from "@/lib/medtrace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/packs/:serial → Pack | 404 */
export async function GET(_req: Request, { params }: { params: Promise<{ serial: string }> }) {
  try {
    const serial = normalizeSerial((await params).serial);
    if (!isValidSerial(serial)) throw new AppError("InvalidSerial");
    const pack = await (await serverReader()).getPack(serial);
    if (!pack) throw new AppError("NOT_FOUND", `No pack ${serial}`, 404);
    return ok(pack);
  } catch (e) {
    return fail(e);
  }
}
