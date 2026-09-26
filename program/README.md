# program/ — P1

Mirror of the Solana Playground project. **Playground is the source of deploys**; this folder must match what's live on devnet.

## Workflow
1. beta.solpg.io → paste `src/lib.rs` → `build` → `deploy`
2. Paste `tests/anchor.test.ts` into Playground's `tests/` → `test`
3. Copy the new Program ID into `declare_id!` here **and** into `app/src/idl/programId.ts`
4. Export IDL → `app/src/idl/medtrace.json` → commit → tell P2

## Local check (optional)
```bash
cd program && cargo check
```

## Status
- [ ] Deployed to devnet — Program ID: `…`
- [ ] All tests pass (incl. duplicate mint, non-holder transfer, double dispense fail)
- [ ] IDL shipped to `app/src/idl/`
