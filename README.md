# Pivota Aurora Chatbox (Frontend)

Mobile-first chat UI for `aurora.pivota.cc/chat`.

`/chat` is now wired to the **pivota-agent** `/v1` BFF (Railway). A legacy UI is kept at `/legacy` during migration.

## Local dev

```bash
npm i
npm run dev
```

Default dev server: `http://localhost:8080`

## Test Stability Guardrails

- Use Node 20 (`nvm use` reads `.nvmrc`).
- Run tests only from this project root. Do not run tests from any `_deploy_tmp_*` directory.
- Desktop workspace is blocked for tests/release. Use `~/dev/...` only.
- Run `npm run test:preflight` before troubleshooting any test issue.
- Run all tests: `npm test`
- Run a targeted test file: `npm run test:file -- src/test/example.test.ts`

## Environment variables

Set these in Vercel (or locally via `.env.local`):

```bash
# pivota-agent BFF (Railway)
VITE_PIVOTA_AGENT_URL=https://pivota-agent-production.up.railway.app

# Pivota shopping UI (PDP + checkout)
VITE_PIVOTA_SHOP_URL=https://agent.pivota.cc

# Back-compat (used when VITE_PIVOTA_AGENT_URL is unset)
VITE_SHOP_GATEWAY_URL=https://pivota-agent-production.up.railway.app

# Legacy (optional): keep old Glow Agent UI working at /legacy
VITE_API_BASE_URL=https://pivota-glow-guide-production.up.railway.app
VITE_UPLOAD_ENDPOINT=https://pivota-glow-guide-production.up.railway.app
```

## Deploy (Vercel)

- Import this repo into Vercel
- Add the env vars above
- Deploy
