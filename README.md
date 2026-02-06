# Pivota Aurora Chatbox (Frontend)

Mobile-first chat UI for `aurora.pivota.cc/chat`.

`/chat` is now wired to the **pivota-agent** `/v1` BFF (Railway). A legacy UI is kept at `/legacy` during migration.

## Local dev

```bash
npm i
npm run dev
```

Default dev server: `http://localhost:8080`

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
