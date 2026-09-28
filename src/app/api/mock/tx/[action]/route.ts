/**
 * Mock-mode write endpoint: POST /api/mock/tx/{mint|transfer|dispense}
 * Same request/response shape a future gasless relayer (/api/tx/*) will use.
 * Disabled unless the app runs in mock mode. Signer identity is trusted here → dev only.
 */
import { ok, fail } from "@/lib/medtrace/api";
import { mockStore } from "@/lib/medtrace/mockStore";
import { config } from "@/lib/medtrace/config";
import { AppError, type TxResult } from "@/lib/medtrace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    if (config.mode !== "mock") throw new AppError("MOCK_DISABLED", "Mock writes are disabled", 403);
    const { action } = await params;
    const b = (await req.json().catch(() => {
      throw new AppError("BAD_QUERY", "Body must be JSON");
    })) as { signer?: string; serial?: string; batch?: string; expiry?: number; newHolder?: string };
    if (!b.signer) throw new AppError("WALLET_NOT_CONNECTED");

    let signature: string;
    switch (action) {
      case "mint":
        signature = await mockStore.mintPack(b.signer, { serial: b.serial ?? "", batch: b.batch ?? "", expiry: Number(b.expiry) });
        break;
      case "transfer":
        signature = await mockStore.transferCustody(b.signer, b.serial ?? "", b.newHolder ?? "");
        break;
      case "dispense":
        signature = await mockStore.dispense(b.signer, b.serial ?? "");
        break;
      default:
        throw new AppError("BAD_QUERY", `Unknown action ${action}`);
    }
    return ok({ signature, explorerUrl: null, simulated: true } satisfies TxResult);
  } catch (e) {
    return fail(e);
  }
}
