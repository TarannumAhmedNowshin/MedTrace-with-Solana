import { ok, fail, SHORT_CACHE } from "@/lib/medtrace/api";
import { isPublicKeyLike } from "@/lib/medtrace/config";
import { serverReader } from "@/lib/medtrace/server";
import { AppError, STATUSES, type Status } from "@/lib/medtrace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/packs?holder=<pk>&status=<Status> → Pack[] */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const status = q.get("status") ?? undefined;
    if (status && !STATUSES.includes(status as Status)) throw new AppError("BAD_QUERY", `Unknown status ${status}`);
    const holder = q.get("holder") ?? undefined;
    if (holder && !isPublicKeyLike(holder)) throw new AppError("BAD_QUERY", "holder must be a base58 public key");
    return ok(await (await serverReader()).listPacks({ holder, status: status as Status | undefined }), 200, SHORT_CACHE);
  } catch (e) {
    return fail(e);
  }
}
