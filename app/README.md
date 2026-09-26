# app/ — P2 (P3 owns `src/app/verify/`)

Next.js app, deployed on Vercel. Not scaffolded yet — P2 does this.

`src/idl/` already exists, so `create-next-app` will refuse this folder. Scaffold elsewhere and copy in without overwriting:

```bash
npx create-next-app@latest /tmp/medtrace-app --ts --app --src-dir --tailwind --eslint --use-npm --no-import-alias
cp -rn /tmp/medtrace-app/. app/
```

Then:
- `src/lib/medtrace.mock.ts` — in-memory mock that returns `Pack` / `VerifyResult` from `src/idl/contract.ts`
- `src/lib/medtrace.ts` — real client once `src/idl/medtrace.json` lands (P1, by 13:00)
- Set the Vercel project root directory to `app/`
