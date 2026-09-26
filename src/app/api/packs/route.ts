import { ok, fail } from "@/lib/medtrace/api";
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
    return ok(await (await serverReader()).listPacks({ holder, status: status as Status | undefined }));
  } catch (e) {
    return fail(e);
  }
}
