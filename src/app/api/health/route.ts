import { ok, fail } from "@/lib/medtrace/api";
import { checkHealth } from "@/lib/medtrace/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health → mode, cluster, program ID, RPC + deployment status. Check before the demo. */
export async function GET() {
  try {
    const h = await checkHealth();
    return ok(h, h.ok ? 200 : 503);
  } catch (e) {
    return fail(e);
  }
}
