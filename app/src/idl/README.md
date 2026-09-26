# app/src/idl — owned by P1

| File | What | Status |
|---|---|---|
| `contract.ts` | Locked types, verdict rule, QR URL helper | ✅ ready — import this now |
| `programId.ts` | Program ID + RPC + Explorer helpers | ⏳ placeholder until deploy |
| `medtrace.json` | Anchor IDL exported from Playground | ⏳ by 13:00 |

After **every** redeploy P1 re-exports the IDL and updates `programId.ts` — a stale IDL is the #1 integration bug.
